import { useConversation } from "@/providers/conversation-provider";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

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
  const { updateConversationSystemPrompt } = useConversation();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt, visible]);

  const trimmedPrompt = prompt.trim();
  const hasChanges = trimmedPrompt !== initialPrompt.trim();
  const isSaveDisabled = !hasChanges || isSaving;

  const handleSave = async () => {
    if (isSaveDisabled) {
      return;
    }
    setIsSaving(true);
    try {
      await updateConversationSystemPrompt(conversationId, trimmedPrompt);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
            style={styles.sheetWrapper}
          >
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.title}>System Prompt</Text>
                <Pressable
                  style={styles.closePill}
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                >
                  <Text style={styles.closePillText}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.subtitle}>
                Conversation: {conversationId}
              </Text>
              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={styles.editorScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.body}>
                  <TextInput
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    editable={!isSaving}
                    placeholder="Describe how the therapist should behave..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    textAlignVertical="top"
                    autoCapitalize="sentences"
                    autoCorrect
                    blurOnSubmit={false}
                    style={styles.input}
                  />
                </View>
              </ScrollView>
              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => {
                    setPrompt(initialPrompt);
                    Keyboard.dismiss();
                  }}
                  disabled={
                    isSaving || (!prompt.length && !initialPrompt.length)
                  }
                >
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                  disabled={isSaving}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.button,
                    styles.primaryButton,
                    isSaveDisabled && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={isSaveDisabled}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSaving ? "Saving..." : "Save Prompt"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#101826",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  editorScroll: {
    maxHeight: 280,
  },
  editorScrollContent: {
    flexGrow: 1,
  },
  body: {
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
  },
  input: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    minHeight: 180,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#4ade80",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#0b1b2b",
    fontWeight: "600",
  },
  closePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closePillText: {
    color: "#fff",
    fontWeight: "500",
  },
});
