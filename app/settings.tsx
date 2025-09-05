import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useConversation } from "@/providers/conversation-provider";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Headphones, Info, Mic, Play, Volume2 } from "lucide-react-native";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { settings, updateSettings } = useConversation();
  const { speak, stop, isSpeaking } = useTextToSpeech();
  const [voices, setVoices] = React.useState<
    { voice_id: string; name: string; preview_url?: string | null }[]
  >([]);
  const [loadingVoices, setLoadingVoices] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const fetchVoices = async () => {
      if (!settings.useElevenLabs) return;
      setLoadingVoices(true);
      setVoiceError(null);
      try {
        const envBase = process.env.EXPO_PUBLIC_API_BASE_URL || "";
        console.log(
          "[Settings:Voices] platform=",
          Platform.OS,
          "envBase=",
          envBase
        );
        const resolvedBase =
          Platform.OS === "web"
            ? envBase ||
              (typeof window !== "undefined" ? window.location.origin : "")
            : envBase;
        console.log("[Settings:Voices] resolvedBase=", resolvedBase);
        if (!resolvedBase) {
          throw new Error(
            "Server URL not configured. Set EXPO_PUBLIC_API_BASE_URL."
          );
        }
        const url = `${resolvedBase}/api/tts`;
        console.log("[Settings:Voices] fetching", url, "method=GET");
        let res = await fetch(url, { method: "GET" });
        console.log("[Settings:Voices] GET status", res.status, res.statusText);
        if (res.status === 405) {
          console.log(
            "[Settings:Voices] GET 405, falling back to POST action=voices"
          );
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "voices" }),
          });
          console.log(
            "[Settings:Voices] POST voices status",
            res.status,
            res.statusText
          );
        }
        if (!res.ok) throw new Error(`Failed to load voices (${res.status})`);
        const data = await res.json();
        console.log(
          "[Settings:Voices] voices loaded count=",
          Array.isArray(data?.voices) ? data.voices.length : 0
        );
        if (isMounted) setVoices(data.voices || []);
      } catch (e: any) {
        console.log("[Settings:Voices] fetch error", e?.message || e);
        if (isMounted) setVoiceError(e?.message || "Failed to load voices");
      } finally {
        if (isMounted) setLoadingVoices(false);
      }
    };
    fetchVoices();
    return () => {
      isMounted = false;
    };
  }, [settings.useElevenLabs]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f3460"]}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Audio Settings</Text>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Volume2 color="#4a9eff" size={20} />
                  <Text style={styles.settingLabel}>Auto-play responses</Text>
                </View>
                <Switch
                  value={settings.autoPlayResponses}
                  onValueChange={(value) =>
                    updateSettings({ autoPlayResponses: value })
                  }
                  trackColor={{ false: "#767577", true: "#4a9eff" }}
                  thumbColor={settings.autoPlayResponses ? "#fff" : "#f4f3f4"}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Mic color="#4a9eff" size={20} />
                  <Text style={styles.settingLabel}>Voice activation</Text>
                </View>
                <Switch
                  value={settings.voiceActivation}
                  onValueChange={(value) =>
                    updateSettings({ voiceActivation: value })
                  }
                  trackColor={{ false: "#767577", true: "#4a9eff" }}
                  thumbColor={settings.voiceActivation ? "#fff" : "#f4f3f4"}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Headphones color="#4a9eff" size={20} />
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingLabel}>Use Eleven Labs TTS</Text>
                    <Text style={styles.settingDescription}>
                      High-quality AI voice (requires API key)
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.useElevenLabs}
                  onValueChange={(value) =>
                    updateSettings({ useElevenLabs: value })
                  }
                  trackColor={{ false: "#767577", true: "#4a9eff" }}
                  thumbColor={settings.useElevenLabs ? "#fff" : "#f4f3f4"}
                />
              </View>

              {settings.useElevenLabs && (
                <View style={{ gap: 8 }}>
                  <View
                    style={[styles.settingItem, { alignItems: "flex-start" }]}
                  >
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingLabel}>Voice</Text>
                    </View>
                  </View>

                  {loadingVoices ? (
                    <Text style={styles.loadingText}>Loading voices…</Text>
                  ) : voiceError ? (
                    <Text style={styles.errorText}>{voiceError}</Text>
                  ) : voices.length === 0 ? (
                    <Text style={styles.loadingText}>No voices available.</Text>
                  ) : (
                    <View style={styles.voiceList}>
                      {voices.map((v) => {
                        const isSelected = settings.voiceId === v.voice_id;
                        return (
                          <View key={v.voice_id} style={styles.voiceRow}>
                            <Pressable
                              style={[
                                styles.voiceChip,
                                isSelected && styles.voiceChipActive,
                              ]}
                              onPress={() =>
                                updateSettings({ voiceId: v.voice_id })
                              }
                              testID={`voice-${v.voice_id}`}
                            >
                              <Text
                                style={styles.voiceChipText}
                                numberOfLines={1}
                              >
                                {v.name}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.previewButton}
                              onPress={async () => {
                                try {
                                  if (isSpeaking) stop();
                                  await Haptics.impactAsync(
                                    Haptics.ImpactFeedbackStyle.Light
                                  ).catch(() => {});
                                  await speak(
                                    "Hello, this is a short sample for this voice.",
                                    true,
                                    v.voice_id
                                  );
                                } catch {}
                              }}
                              testID={`preview-${v.voice_id}`}
                            >
                              <Play size={14} color="#4a9eff" />
                              <Text style={styles.previewText}>Preview</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Mic color="#4a9eff" size={20} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>
                    Max recording duration
                  </Text>
                  <Text style={styles.settingDescription}>
                    Prevents oversized uploads and timeouts
                  </Text>
                </View>
              </View>
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                {[60, 120, 180].map((sec) => (
                  <Pressable
                    key={sec}
                    style={[
                      styles.durationChip,
                      settings.maxRecordingDurationSec === sec &&
                        styles.durationChipActive,
                    ]}
                    onPress={() =>
                      updateSettings({ maxRecordingDurationSec: sec })
                    }
                    testID={`duration-${sec}`}
                  >
                    <Text style={styles.durationChipText}>{sec / 60}m</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About IFS Therapy</Text>
              <View style={styles.infoCard}>
                <Info color="#4a9eff" size={20} />
                <Text style={styles.infoText}>
                  Internal Family Systems (IFS) is a therapeutic approach that
                  views the mind as having different &ldquo;parts&rdquo; or
                  sub-personalities, with a core &ldquo;Self&rdquo; that can
                  lead and heal these parts.
                </Text>
              </View>
              <Text style={styles.disclaimer}>
                This app is for educational and self-exploration purposes only.
                It is not a substitute for professional therapy or medical
                advice.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "rgba(74, 158, 255, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 158, 255, 0.3)",
    marginBottom: 16,
  },
  infoText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingDescription: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginTop: 2,
  },
  durationChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 158, 255, 0.5)",
    backgroundColor: "rgba(74, 158, 255, 0.1)",
  },
  durationChipActive: {
    backgroundColor: "rgba(74, 158, 255, 0.3)",
    borderColor: "rgba(74, 158, 255, 0.9)",
  },
  durationChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  disclaimer: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    lineHeight: 16,
    fontStyle: "italic",
  },
  loadingText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 12,
    paddingVertical: 8,
  },
  voiceList: {
    gap: 8,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  voiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 158, 255, 0.5)",
    backgroundColor: "rgba(74, 158, 255, 0.1)",
    flexShrink: 1,
    maxWidth: "70%",
  },
  voiceChipActive: {
    backgroundColor: "rgba(74, 158, 255, 0.3)",
    borderColor: "rgba(74, 158, 255, 0.9)",
  },
  voiceChipText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(74, 158, 255, 0.15)",
  },
  previewText: {
    color: "#4a9eff",
    fontSize: 12,
    fontWeight: "600",
  },
});
