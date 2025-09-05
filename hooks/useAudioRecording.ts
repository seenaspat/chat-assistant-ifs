import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const totalWebBytesRef = useRef<number>(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Limits to keep uploads small and reliable
  const MAX_DURATION_MS = 2 * 60 * 1000; // 2 minutes
  const MAX_WEB_BLOB_BYTES = 20 * 1024 * 1024; // 20 MB

  const startRecording = async () => {
    try {
      setLastError(null);
      // Clear any previous timer/bytes
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      isStoppingRef.current = false;
      totalWebBytesRef.current = 0;

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
            totalWebBytesRef.current += event.data.size;
            console.log(
              "[Audio] dataavailable size=",
              event.data.size,
              "chunks=",
              chunksRef.current.length,
              "totalBytes=",
              totalWebBytesRef.current
            );
            if (
              totalWebBytesRef.current > MAX_WEB_BLOB_BYTES &&
              !isStoppingRef.current
            ) {
              console.warn(
                "[Audio] Web blob exceeded threshold; auto-stopping recording"
              );
              // Defer to ensure state flows correctly
              Promise.resolve().then(() => stopRecording());
            }
          }
        };
        mediaRecorder.onerror = (e) => {
          console.error("[Audio] MediaRecorder error", e);
        };

        // Request periodic dataavailable events to avoid one huge chunk in memory
        mediaRecorder.start(1000);
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
            // Use AAC in .m4a for small, high-quality voice recordings
            extension: ".m4a",
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 96000,
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

      // Auto-stop after max duration to avoid oversized uploads
      stopTimerRef.current = setTimeout(() => {
        if (!isStoppingRef.current) {
          console.warn("[Audio] Auto-stopping after max duration");
          Promise.resolve().then(() => stopRecording());
        }
      }, MAX_DURATION_MS);
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (isStoppingRef.current) {
      return null;
    }
    isStoppingRef.current = true;
    if (!isRecording) {
      console.log("[Audio] Recording is not active, skipping stop");
      isStoppingRef.current = false;
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
            isStoppingRef.current = false;
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
            totalWebBytesRef.current = 0;
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
            if (stopTimerRef.current) {
              clearTimeout(stopTimerRef.current);
              stopTimerRef.current = null;
            }
            isStoppingRef.current = false;
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
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
          }
          isStoppingRef.current = false;
          return null;
        }

        // Check if recording is still active before stopping
        const status = await recording.getStatusAsync();
        if (!status.isRecording) {
          console.log("[Audio] Native recording not active, cleaning up");
          recordingRef.current = null;
          setIsRecording(false);
          setIsProcessing(false);
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
          }
          isStoppingRef.current = false;
          return null;
        }

        await recording.stopAndUnloadAsync();
        recordingRef.current = null;

        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

        const uri = recording.getURI();
        if (!uri) {
          setIsRecording(false);
          setIsProcessing(false);
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
          }
          isStoppingRef.current = false;
          return null;
        }

        const transcript = await transcribeAudioFromUri(uri);

        setIsRecording(false);
        setIsProcessing(false);
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        isStoppingRef.current = false;
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
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      isStoppingRef.current = false;
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
        let errorMessage = `Transcription failed (${response.status})`;
        if (contentType.includes("application/json")) {
          try {
            const errJson = await response.json();
            errorMessage = errJson?.error || errorMessage;
          } catch {}
        } else {
          const errText = await response.text().catch(() => "");
          if (errText)
            errorMessage = `${errorMessage}: ${errText.slice(0, 200)}`;
        }
        setLastError(errorMessage);
        return null;
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        console.error(
          "[Audio] Unexpected content-type from /api/stt; first 200 chars:",
          text.slice(0, 200)
        );
        setLastError("Invalid response from STT endpoint");
        return null;
      }

      const data = await response.json();
      console.log("[Audio] /api/stt response text=", data?.text);
      if (!data?.text) {
        setLastError("Empty transcription result");
        return null;
      }
      return data.text;
    } catch (error) {
      console.error("[Audio] Transcription error:", error);
      setLastError((error as Error)?.message || "Unknown error");
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
      formData.append("audio", audioFile as unknown as Blob);

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
        let errorMessage = `Transcription failed (${response.status})`;
        if (contentType.includes("application/json")) {
          try {
            const errJson = await response.json();
            errorMessage = errJson?.error || errorMessage;
          } catch {}
        } else {
          const errText = await response.text().catch(() => "");
          if (errText)
            errorMessage = `${errorMessage}: ${errText.slice(0, 200)}`;
        }
        setLastError(errorMessage);
        return null;
      }

      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        console.error(
          "[Audio] Unexpected content-type from /api/stt (native); first 200 chars:",
          text.slice(0, 200)
        );
        setLastError("Invalid response from STT endpoint");
        return null;
      }

      const data = await response.json();
      if (!data?.text) {
        setLastError("Empty transcription result");
        return null;
      }
      return data.text;
    } catch (error) {
      console.error("Transcription error:", error);
      setLastError((error as Error)?.message || "Unknown error");
      return null;
    }
  };

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    };
  }, []);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    lastError,
  };
}
