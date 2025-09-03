import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface SystemPromptEditorProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  initialPrompt: string;
}

export default function SystemPromptEditor({
  visible,
  onClose,
  conversationId,
  initialPrompt,
}: SystemPromptEditorProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>System Prompt</Text>
          <Text style={styles.subtitle}>Conversation: {conversationId}</Text>
          <View style={styles.body}>
            <Text style={styles.prompt} numberOfLines={6}>
              {initialPrompt || "No prompt set."}
            </Text>
          </View>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#101826",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
    fontSize: 12,
  },
  body: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
  },
  prompt: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
  },
  button: {
    marginTop: 12,
    alignSelf: "flex-end",
    backgroundColor: "#4ade80",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buttonText: {
    color: "#0b1b2b",
    fontWeight: "600",
  },
});
