import { elevenLabsProvider } from "@/utils/ai-providers";
import * as Speech from "expo-speech";
import { useRef, useState } from "react";
import { Platform } from "react-native";

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = async (text: string, useElevenLabs: boolean = false) => {
    if (useElevenLabs) {
      try {
        setIsSpeaking(true);

        // Use the Eleven Labs provider
        const response = await elevenLabsProvider.generateSpeech({ text });

        if (Platform.OS === "web") {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);

          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }

          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
          };

          await audio.play();
        } else {
          // For mobile, we'd need to save the audio file and play it
          // For now, fall back to native TTS
          console.warn(
            "Eleven Labs not fully supported on mobile yet, using native TTS"
          );
          return speakNative(text);
        }
      } catch (error) {
        console.error("Eleven Labs TTS error:", error);
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
