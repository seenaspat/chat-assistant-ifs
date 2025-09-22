import { useConversation } from "@/providers/conversation-provider";
import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
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
  const recordStartRef = useRef<number | null>(null);

  const { settings } = useConversation();
  const MAX_DURATION_MS = useMemo(
    () => Math.max(30, Math.min(600, settings.maxRecordingDurationSec)) * 1000,
    [settings.maxRecordingDurationSec]
  );
  const MAX_WEB_BLOB_BYTES = 20 * 1024 * 1024; // 20 MB

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const startRecording = async () => {
    try {
      setLastError(null);
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
          }
        };
        mediaRecorder.onerror = (e) =>
          console.error("[Audio] MediaRecorder error", e);
        mediaRecorder.start(1000);
        console.log(
          "[Audio] mediaRecorder started, state=",
          mediaRecorder.state
        );
        setIsRecording(true);
      } else {
        // iOS/Android: enable recording session and request permission
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error("Microphone permission denied");
        // Critical for iOS: allow recording and play in silent mode
        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        // Ensure any previous recording is reset
        try {
          if (audioRecorder.isRecording) audioRecorder.stop();
        } catch {}
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        recordStartRef.current = Date.now();
        // Wait for recorder to enter recording state
        for (let i = 0; i < 20; i++) {
          if (audioRecorder.isRecording) break;
          await sleep(25);
        }
        setIsRecording(true);
      }

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
    if (isStoppingRef.current) return null;
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
            const audioBlob = new Blob(chunksRef.current, {
              type: "audio/webm",
            });
            chunksRef.current = [];
            const transcript = await transcribeAudio(audioBlob);
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((t) => t.stop());
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
          mediaRecorder.stop();
        });
      } else {
        // Ensure a minimum capture duration (~700ms) before stopping
        const startedAt = recordStartRef.current ?? Date.now();
        const elapsed = Date.now() - startedAt;
        if (elapsed < 700) await sleep(700 - elapsed);

        if (audioRecorder.isRecording) {
          try {
            await audioRecorder.stop();
          } catch (e) {
            console.log("[Audio] expo-audio stop() threw", e);
          }
        }
        const uri = audioRecorder.uri;
        console.log("[Audio] getURI()=", uri);
        if (!uri) {
          setLastError("No recorded audio available");
          setIsRecording(false);
          setIsProcessing(false);
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
          }
          isStoppingRef.current = false;
          // Restore audio mode
          await AudioModule.setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          }).catch(() => {});
          return null;
        }
        // Wait for file to flush and grow (up to ~5s)
        let size = 0;
        for (let i = 0; i < 100; i++) {
          const info = await FileSystem.getInfoAsync(uri).catch(
            () => null as any
          );
          size = (info as any)?.size ?? 0;
          if (size > 1024) break;
          await sleep(50);
        }
        console.log("[Audio] recorded file size=", size);
        if (!size || size < 1024) {
          setLastError("Recording too short or empty");
          setIsRecording(false);
          setIsProcessing(false);
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
          }
          isStoppingRef.current = false;
          await AudioModule.setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          }).catch(() => {});
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
        await AudioModule.setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        }).catch(() => {});
        return transcript;
      }
    } catch (error) {
      console.error("[Audio] Failed to stop recording:", error);
      if (Platform.OS === "web") {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
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
      if (Platform.OS !== "web") {
        await AudioModule.setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        }).catch(() => {});
      }
      return null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      if (!baseUrl) throw new Error("Missing API base URL");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const response = await fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        let errorMessage = `Transcription failed (${response.status})`;
        if (contentType.includes("application/json")) {
          try {
            const errJson = await response.json();
            errorMessage = errJson?.error || errorMessage;
          } catch {}
        }
        setLastError(errorMessage);
        return null;
      }
      if (!contentType.includes("application/json")) return null;
      const data = await response.json();
      if (!data?.text) {
        setLastError("Empty transcription result");
        return null;
      }
      return data.text;
    } catch (error) {
      setLastError((error as Error)?.message || "Unknown error");
      return null;
    }
  };

  const drainChunkQueue = async () => {
    if (isChunkUploadInFlightRef.current) return;
    isChunkUploadInFlightRef.current = true;
    try {
      while (pendingChunksRef.current.length > 0) {
        const part = pendingChunksRef.current.shift();
        if (!part) break;
        const text = await transcribeAudio(part);
        if (text) {
          streamingTranscriptRef.current =
            `${streamingTranscriptRef.current} ${text}`.trim();
        } else {
          streamingErrorsRef.current += 1;
        }
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
      } as any;
      const formData = new FormData();
      formData.append("audio", audioFile as unknown as Blob);
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      if (!baseUrl) throw new Error("Missing API base URL");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const response = await fetch(`${baseUrl}/api/stt`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        let errorMessage = `Transcription failed (${response.status})`;
        if (contentType.includes("application/json")) {
          try {
            const errJson = await response.json();
            errorMessage = errJson?.error || errorMessage;
          } catch {}
        }
        setLastError(errorMessage);
        return null;
      }
      if (!contentType.includes("application/json")) return null;
      const data = await response.json();
      if (!data?.text) {
        setLastError("Empty transcription result");
        return null;
      }
      return data.text;
    } catch (error) {
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
