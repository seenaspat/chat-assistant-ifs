import { useConversation } from "@/providers/conversation-provider";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Headphones, Info, Mic, Volume2 } from "lucide-react-native";
import React from "react";
import {
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
});
