import { Audio } from "expo-av";
import { useRef, useState } from "react";
import { Platform } from "react-native";

export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        console.log("[Audio] requesting mic permission via getUserMedia");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm",
        });
        mediaRecorderRef.current = mediaRecorder;

        chunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
            console.log(
              "[Audio] dataavailable size=",
              event.data.size,
              "chunks=",
              chunksRef.current.length
            );
          }
        };
        mediaRecorder.onerror = (e) => {
          console.error("[Audio] MediaRecorder error", e);
        };

        mediaRecorder.start();
        console.log(
          "[Audio] mediaRecorder started, state=",
          mediaRecorder.state
        );
        setIsRecording(true);
      } else {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: ".m4a",
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
          },
          ios: {
            extension: ".wav",
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          web: {
            mimeType: "audio/webm",
            bitsPerSecond: 128000,
          },
        });

        await recording.startAsync();
        recordingRef.current = recording;
        setIsRecording(true);
      }
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!isRecording) {
      console.log("[Audio] Recording is not active, skipping stop");
      return null;
    }

    setIsProcessing(true);

    try {
      if (Platform.OS === "web") {
        return new Promise((resolve) => {
          const mediaRecorder = mediaRecorderRef.current;
          if (!mediaRecorder || mediaRecorder.state === "inactive") {
            setIsRecording(false);
            setIsProcessing(false);
            resolve(null);
            return;
          }

          mediaRecorder.onstop = async () => {
            const chunkCount = chunksRef.current.length;
            const size = chunksRef.current.reduce(
              (s, c: any) => s + (c?.size || 0),
              0
            );
            console.log(
              "[Audio] mediaRecorder stopped; chunks=",
              chunkCount,
              "bytes=",
              size
            );
            const audioBlob = new Blob(chunksRef.current, {
              type: "audio/webm",
            });
            chunksRef.current = [];
            console.log(
              "[Audio] built blob type=",
              audioBlob.type,
              "size=",
              audioBlob.size
            );
            const transcript = await transcribeAudio(audioBlob);

            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
            }

            mediaRecorderRef.current = null;
            setIsRecording(false);
            setIsProcessing(false);
            resolve(transcript);
          };

          console.log(
            "[Audio] stopping mediaRecorder, state=",
            mediaRecorder.state
          );
          mediaRecorder.stop();
        });
      } else {
        const recording = recordingRef.current;
        if (!recording) {
          setIsRecording(false);
          setIsProcessing(false);
          return null;
        }

        // Check if recording is still active before stopping
        const status = await recording.getStatusAsync();
        if (!status.isRecording) {
          console.log("[Audio] Native recording not active, cleaning up");
          recordingRef.current = null;
          setIsRecording(false);
          setIsProcessing(false);
          return null;
        }

        await recording.stopAndUnloadAsync();
        recordingRef.current = null;

        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

        const uri = recording.getURI();
        if (!uri) {
          setIsRecording(false);
          setIsProcessing(false);
          return null;
        }

        const transcript = await transcribeAudioFromUri(uri);

        setIsRecording(false);
        setIsProcessing(false);
        return transcript;
      }
    } catch (error) {
      console.error("[Audio] Failed to stop recording:", error);

      // Clean up references on error
      if (Platform.OS === "web") {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
      } else {
        recordingRef.current = null;
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch (audioError) {
          console.error("[Audio] Failed to reset audio mode:", audioError);
        }
      }

      setIsRecording(false);
      setIsProcessing(false);
      return null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
    try {
      const formData = new FormData();
      // Match filename to blob type to help servers infer format
      formData.append("audio", audioBlob, "recording.webm");

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      if (!baseUrl) {
        console.error(
          "[Audio] EXPO_PUBLIC_API_BASE_URL is not set; cannot call /api/stt"
        );
        throw new Error("Missing API base URL");
      }

      console.log(
        "[Audio] POST /api/stt baseUrl=",
        baseUrl,
        "blobSize=",
        audioBlob.size
      );
      const response = await fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      console.log("[Audio] /api/stt status=", response.status, contentType);
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(
          "[Audio] Transcription failed: ",
          response.status,
          errText
        );
        throw new Error("Transcription failed");
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        console.error(
          "[Audio] Unexpected content-type from /api/stt; first 200 chars:",
          text.slice(0, 200)
        );
        throw new Error("Invalid response from STT endpoint");
      }

      const data = await response.json();
      console.log("[Audio] /api/stt response text=", data?.text);
      return data.text || null;
    } catch (error) {
      console.error("[Audio] Transcription error:", error);
      return null;
    }
  };

  const transcribeAudioFromUri = async (
    uri: string
  ): Promise<string | null> => {
    try {
      const uriParts = uri.split(".");
      const fileType = uriParts[uriParts.length - 1];

      const audioFile = {
        uri,
        name: `recording.${fileType}`,
        type: `audio/${fileType}`,
      };

      const formData = new FormData();
      formData.append("audio", audioFile as any);

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      if (!baseUrl) {
        console.error(
          "[Audio] EXPO_PUBLIC_API_BASE_URL is not set (native); cannot call /api/stt"
        );
        throw new Error("Missing API base URL");
      }

      const response = await fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        console.error(
          "[Audio] Unexpected content-type from /api/stt (native); first 200 chars:",
          text.slice(0, 200)
        );
        throw new Error("Invalid response from STT endpoint");
      }

      const data = await response.json();
      return data.text || null;
    } catch (error) {
      console.error("Transcription error:", error);
      return null;
    }
  };

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
  };
}
