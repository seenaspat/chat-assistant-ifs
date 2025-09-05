import { useConversation } from "@/providers/conversation-provider";
import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const totalWebBytesRef = useRef<number>(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const pendingChunksRef = useRef<Blob[]>([]);
  const isChunkUploadInFlightRef = useRef<boolean>(false);
  const streamingTranscriptRef = useRef<string>("");
  const streamingErrorsRef = useRef<number>(0);

  const { settings } = useConversation();
  const MAX_DURATION_MS = useMemo(
    () => Math.max(30, Math.min(600, settings.maxRecordingDurationSec)) * 1000,
    [settings.maxRecordingDurationSec]
  );
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
              settings.experimentalStreamingTranscription &&
              event.data.size > 8 * 1024
            ) {
              try {
                pendingChunksRef.current.push(event.data);
                void drainChunkQueue();
              } catch (e) {
                console.warn("[Audio] Failed to queue chunk for streaming", e);
              }
            }
            if (
              totalWebBytesRef.current > MAX_WEB_BLOB_BYTES &&
              !isStoppingRef.current
            ) {
              console.warn(
                "[Audio] Web blob exceeded threshold; auto-stopping recording"
              );
              setLastError(
                "Recording auto-stopped due to size limit. Consider a shorter clip."
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
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error("Microphone permission denied");
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
      }

      // Auto-stop after max duration to avoid oversized uploads
      stopTimerRef.current = setTimeout(() => {
        if (!isStoppingRef.current) {
          console.warn("[Audio] Auto-stopping after max duration");
          setLastError(
            `Recording auto-stopped after ${Math.round(
              MAX_DURATION_MS / 1000
            )}s to prevent timeouts.`
          );
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
            const aggregate = streamingTranscriptRef.current.trim();
            streamingTranscriptRef.current = "";
            resolve(transcript || (aggregate.length ? aggregate : null));
          };

          console.log(
            "[Audio] stopping mediaRecorder, state=",
            mediaRecorder.state
          );
          mediaRecorder.stop();
        });
      } else {
        // expo-audio path
        console.log(
          "[Audio] expo-audio isRecording before stop=",
          audioRecorder.isRecording
        );
        try {
          // Stop if currently recording; if it's already stopped, this should be a no-op
          if (audioRecorder.isRecording) {
            console.log("[Audio] Stopping expo-audio recorder...");
            await audioRecorder.stop();
          } else {
            console.log(
              "[Audio] Recorder not recording at stop time; continuing"
            );
          }
        } catch (e) {
          console.log("[Audio] expo-audio stop() threw", e);
        }
        const uri = audioRecorder.uri;
        console.log("[Audio] getURI()=", uri);
        if (uri) {
          try {
            const info = await FileSystem.getInfoAsync(uri);
            console.log(
              "[Audio] file info exists=",
              info.exists,
              "isDirectory=",
              (info as any)?.isDirectory
            );
          } catch (e) {
            console.log("[Audio] getInfoAsync failed", e);
          }
        }
        if (!uri) {
          setLastError("No recorded audio available");
          setIsRecording(false);
          setIsProcessing(false);
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
          }
        } else {
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
        isStoppingRef.current = false;
        return null;
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
        "[Audio] POST /api/stt (web) baseUrl=",
        baseUrl,
        "blobSize=",
        audioBlob.size
      );
      const controller = new AbortController();
      const STT_TIMEOUT_MS = 45000;
      const timeoutId = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
      const response = await fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const contentType = response.headers.get("content-type") || "";
      console.log(
        "[Audio] /api/stt (web) status=",
        response.status,
        contentType
      );
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
      console.log(
        "[Audio] /api/stt (web) response text len=",
        (data?.text || "").length
      );
      if (!data?.text) {
        setLastError("Empty transcription result");
        return null;
      }
      return data.text;
    } catch (error) {
      const isAbort = (error as any)?.name === "AbortError";
      console.error("[Audio] Transcription error (web):", error);
      setLastError(
        isAbort
          ? "Transcription timed out"
          : (error as Error)?.message || "Unknown error"
      );
      return null;
    }
  };

  // Drain pendingChunksRef by sending each chunk to the same endpoint; append text
  const drainChunkQueue = async () => {
    if (isChunkUploadInFlightRef.current) return;
    isChunkUploadInFlightRef.current = true;
    try {
      while (pendingChunksRef.current.length > 0) {
        const part = pendingChunksRef.current.shift();
        if (!part) break;
        const text = await transcribeAudio(part);
        if (text) {
          // Space-separate to avoid accidental token merging
          streamingTranscriptRef.current =
            `${streamingTranscriptRef.current} ${text}`.trim();
        } else {
          streamingErrorsRef.current += 1;
        }
        // Backoff if multiple errors
        if (streamingErrorsRef.current > 3) break;
      }
    } finally {
      isChunkUploadInFlightRef.current = false;
    }
  };

  const waitForChunkUploadsToDrain = async (timeoutMs: number) => {
    const start = Date.now();
    while (
      (pendingChunksRef.current.length > 0 ||
        isChunkUploadInFlightRef.current) &&
      Date.now() - start < timeoutMs
    ) {
      await new Promise((r) => setTimeout(r, 100));
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

      try {
        const info = await FileSystem.getInfoAsync(uri);
        console.log(
          "[Audio] POST /api/stt (native) uri=",
          uri,
          "exists=",
          info.exists,
          "isDirectory=",
          (info as any)?.isDirectory
        );
      } catch {}

      const controller = new AbortController();
      const STT_TIMEOUT_MS = 45000;
      const timeoutId = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
      const response = await fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const contentType = response.headers.get("content-type") || "";
      console.log(
        "[Audio] /api/stt (native) status=",
        response.status,
        response.statusText,
        contentType
      );
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
      console.log(
        "[Audio] /api/stt (native) text len=",
        (data?.text || "").length
      );
      if (!data?.text) {
        setLastError("Empty transcription result");
        return null;
      }
      return data.text;
    } catch (error) {
      const isAbort = (error as any)?.name === "AbortError";
      console.error("[Audio] Transcription error (native):", error);
      setLastError(
        isAbort
          ? "Transcription timed out"
          : (error as Error)?.message || "Unknown error"
      );
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
