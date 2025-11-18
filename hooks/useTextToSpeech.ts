import { useConversation } from "@/providers/conversation-provider";
import { elevenLabsProvider } from "@/utils/ai-providers";
import { createAudioPlayer, setIsAudioActiveAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { EncodingType } from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { useRef, useState } from "react";
import { Platform } from "react-native";

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { settings } = useConversation();

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const base64Chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let base64 = "";
    const len = bytes.length;
    let i = 0;
    for (; i < len - 2; i += 3) {
      base64 += base64Chars[bytes[i] >> 2];
      base64 += base64Chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += base64Chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64 += base64Chars[bytes[i + 2] & 63];
    }
    if (i < len) {
      base64 += base64Chars[bytes[i] >> 2];
      if (i === len - 1) {
        base64 += base64Chars[(bytes[i] & 3) << 4] + "==";
      } else {
        base64 += base64Chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
        base64 += base64Chars[(bytes[i + 1] & 15) << 2] + "=";
      }
    }
    return base64;
  };

  const speak = async (
    text: string,
    useRemoteTTS: boolean = false,
    voiceIdOverride?: string
  ) => {
    if (useRemoteTTS) {
      try {
        setIsSpeaking(true);

        // Use remote provider (OpenAI or ElevenLabs) behind /api/tts
        console.log("[TTS] remote TTS ON, generating speech...");
        const response = await elevenLabsProvider.generateSpeech({
          text,
          voice: voiceIdOverride || settings.voiceId || undefined,
          provider:
            ((settings as any).ttsProvider as "openai" | "elevenlabs") ||
            (settings.useElevenLabs ? "elevenlabs" : "openai"),
          speed: ((settings as any).ttsSpeed as number) || 1.0,
        });

        if (Platform.OS === "web") {
          console.log("[TTS] got response; converting to blob");
          const audioBlob = await response.blob();
          console.log(
            "[TTS] blob size=",
            audioBlob.size,
            "type=",
            audioBlob.type
          );
          const audioUrl = URL.createObjectURL(audioBlob);

          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }

          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onended = () => {
            console.log("[TTS] audio ended");
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
          };

          audio.onerror = () => {
            console.error("[TTS] audio playback error");
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
          };

          // Apply playbackRate for web
          const rate = settings.ttsSpeed ?? 1.0;
          if (!Number.isNaN(rate) && rate > 0) {
            audio.playbackRate = rate;
          }
          console.log("[TTS] playing audio...");
          await audio.play();
        } else {
          console.log("[TTS] native: creating temp file");
          const dir =
            ((FileSystem as any).cacheDirectory as string) ||
            ((FileSystem as any).documentDirectory as string) ||
            "";
          const tempUri = `${dir}tts-${Date.now()}.mp3`;
          let arrayBuffer: ArrayBuffer | null = null;
          if (typeof (response as any).arrayBuffer === "function") {
            try {
              arrayBuffer = await (response as any).arrayBuffer();
            } catch {}
          }
          if (!arrayBuffer && typeof (response as any).blob === "function") {
            try {
              const blob: any = await (response as any).blob();
              if (blob && typeof blob.arrayBuffer === "function") {
                arrayBuffer = await blob.arrayBuffer();
              }
            } catch {}
          }

          if (!arrayBuffer) {
            console.warn(
              "[TTS] no arrayBuffer support; falling back to native TTS"
            );
            setIsSpeaking(false);
            return speakNative(text);
          }

          const base64 = arrayBufferToBase64(arrayBuffer);
          await FileSystem.writeAsStringAsync(tempUri, base64, {
            encoding: EncodingType.Base64,
          });

          await setIsAudioActiveAsync(true);
          const player = createAudioPlayer(tempUri);
          const nativeRate = settings.ttsSpeed ?? 1.0;
          try {
            // Property exists on AudioPlayer per expo-audio typings
            (player as unknown as { playbackRate: number }).playbackRate =
              nativeRate;
          } catch {}
          player.play();

          const poll = setInterval(() => {
            if (!player.playing) {
              clearInterval(poll);
              setIsSpeaking(false);
              try {
                player.remove();
              } catch {}
              FileSystem.deleteAsync(tempUri).catch(() => {});
            }
          }, 500);
          return;
        }
      } catch (error) {
        console.error("Remote TTS error:", error);
        setIsSpeaking(false);
        // Fall back to native TTS
        return speakNative(text);
      }
    } else {
      return speakNative(text);
    }
  };

  const speakNative = async (text: string) => {
    if (Platform.OS === "web" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (voice) =>
            voice.name.includes("Female") ||
            voice.name.includes("Samantha") ||
            voice.name.includes("Karen")
        );

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("TTS error:", error);
        setIsSpeaking(false);
      }
    } else {
      // Mobile TTS using expo-speech
      try {
        setIsSpeaking(true);
        await Speech.speak(text, {
          rate: 0.9,
          pitch: 1.0,
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch (error) {
        console.error("Mobile TTS error:", error);
        setIsSpeaking(false);
      }
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (Platform.OS === "web" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    } else {
      Speech.stop();
    }

    setIsSpeaking(false);
  };

  return {
    isSpeaking,
    speak,
    stop,
  };
}
