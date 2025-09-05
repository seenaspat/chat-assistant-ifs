import { createAIProvider } from "@/utils/ai-providers";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ModelMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationSettings {
  autoPlayResponses: boolean;
  voiceActivation: boolean;
  useElevenLabs: boolean;
  maxRecordingDurationSec: number;
  experimentalStreamingTranscription: boolean;
}

const IFS_SYSTEM_PROMPT = `You are a compassionate IFS (Internal Family Systems) therapist. Your role is to help users explore their internal parts and connect with their Self.

Key IFS principles to follow:
1. Everyone has multiple "parts" (sub-personalities) and a core "Self"
2. Parts often carry burdens from past experiences
3. The Self is naturally curious, compassionate, and capable of healing
4. Help users identify and dialogue with their parts
5. Encourage Self-leadership rather than part-leadership
6. Use gentle, curious language like "What part of you feels that way?"
7. Help users understand what their parts are trying to protect or achieve
8. Validate all parts while helping the Self take leadership

Keep responses conversational, warm, and under 100 words. Ask one thoughtful question at a time to help users explore their internal landscape.`;

export const [ConversationProvider, useConversation] = createContextHook(() => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<ConversationSettings>({
    autoPlayResponses: true,
    voiceActivation: false,
    useElevenLabs: false,
    maxRecordingDurationSec: 120,
    experimentalStreamingTranscription: false,
  });

  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId),
    [conversations, currentConversationId]
  );

  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation]
  );

  const saveConversations = useCallback(
    async (newConversations: Conversation[]) => {
      try {
        await AsyncStorage.setItem(
          "ifs_conversations",
          JSON.stringify(newConversations)
        );
      } catch (error) {
        console.error("Failed to save conversations:", error);
      }
    },
    []
  );

  const generateConversationTitle = useCallback(
    (messages: Message[]): string => {
      const firstUserMessage = messages.find((m) => m.role === "user");
      if (firstUserMessage) {
        const words = firstUserMessage.content.split(" ").slice(0, 6);
        return (
          words.join(" ") +
          (firstUserMessage.content.split(" ").length > 6 ? "..." : "")
        );
      }
      return `Conversation ${new Date().toLocaleDateString()}`;
    },
    []
  );

  const loadConversations = useCallback(async () => {
    try {
      // First, try to load new format
      const storedConversations = await AsyncStorage.getItem(
        "ifs_conversations"
      );
      if (storedConversations) {
        const parsedConversations = JSON.parse(storedConversations).map(
          (conv: any) => ({
            ...conv,
            createdAt: new Date(conv.createdAt),
            updatedAt: new Date(conv.updatedAt),
            messages: conv.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            })),
          })
        );
        setConversations(parsedConversations);

        // Set current conversation to the most recent one
        if (parsedConversations.length > 0) {
          const mostRecent = parsedConversations.sort(
            (a: Conversation, b: Conversation) =>
              b.updatedAt.getTime() - a.updatedAt.getTime()
          )[0];
          setCurrentConversationId(mostRecent.id);
        }
        return;
      }

      // Fallback: migrate old format
      const oldMessages = await AsyncStorage.getItem("ifs_messages");
      if (oldMessages) {
        const parsedMessages = JSON.parse(oldMessages).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));

        if (parsedMessages.length > 0) {
          const migratedConversation: Conversation = {
            id: Date.now().toString(),
            title: generateConversationTitle(parsedMessages),
            messages: parsedMessages,
            createdAt: parsedMessages[0]?.timestamp || new Date(),
            updatedAt:
              parsedMessages[parsedMessages.length - 1]?.timestamp ||
              new Date(),
          };

          setConversations([migratedConversation]);
          setCurrentConversationId(migratedConversation.id);

          // Save in new format and remove old
          await saveConversations([migratedConversation]);
          await AsyncStorage.removeItem("ifs_messages");
        }
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }, [generateConversationTitle, saveConversations]);

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("ifs_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadSettings();
  }, [loadConversations, loadSettings]);

  const saveSettings = useCallback(
    async (newSettings: ConversationSettings) => {
      try {
        await AsyncStorage.setItem("ifs_settings", JSON.stringify(newSettings));
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    },
    []
  );

  // Provider via proxy (Vercel/Edge)
  const createProxyProvider = useCallback(
    () => createAIProvider({ provider: "proxy" }),
    []
  );

  const createNewConversation = useCallback(
    async (systemPrompt?: string): Promise<string> => {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: `New Conversation`,
        messages: [],
        systemPrompt: systemPrompt || IFS_SYSTEM_PROMPT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedConversations = [newConversation, ...conversations];
      setConversations(updatedConversations);
      setCurrentConversationId(newConversation.id);
      await saveConversations(updatedConversations);

      return newConversation.id;
    },
    [conversations, saveConversations]
  );

  const sendMessage = useCallback(
    async (content: string): Promise<string | null> => {
      // Create new conversation if none exists
      let targetConversationId = currentConversationId;
      if (!targetConversationId) {
        targetConversationId = await createNewConversation();
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const targetConversation = conversations.find(
        (c) => c.id === targetConversationId
      );
      const updatedMessages = [
        ...(targetConversation?.messages || []),
        userMessage,
      ];

      // Update conversation with new user message
      const updatedConversations = conversations.map((conv) =>
        conv.id === targetConversationId
          ? { ...conv, messages: updatedMessages, updatedAt: new Date() }
          : conv
      );
      setConversations(updatedConversations);
      setIsLoading(true);

      try {
        const systemPrompt =
          targetConversation?.systemPrompt || IFS_SYSTEM_PROMPT;
        const conversationMessages: ModelMessage[] = [
          { role: "system", content: systemPrompt },
          ...updatedMessages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ];

        const provider = createProxyProvider();
        const result = await provider.generateText({
          messages: conversationMessages,
        });

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.text,
          timestamp: new Date(),
        };

        const finalMessages = [...updatedMessages, assistantMessage];

        // Update conversation with assistant response
        const finalConversations = updatedConversations.map((conv) =>
          conv.id === targetConversationId
            ? {
                ...conv,
                messages: finalMessages,
                updatedAt: new Date(),
                title:
                  conv.messages.length === 0
                    ? generateConversationTitle(finalMessages)
                    : conv.title,
              }
            : conv
        );

        setConversations(finalConversations);
        await saveConversations(finalConversations);

        return result.text;
      } catch (error) {
        console.error("Failed to send message:", error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      conversations,
      currentConversationId,
      createProxyProvider,
      createNewConversation,
      saveConversations,
      generateConversationTitle,
    ]
  );

  const sendMessageStream = useCallback(
    async (
      content: string,
      onChunk?: (chunk: string) => void
    ): Promise<string | null> => {
      // Create new conversation if none exists
      let targetConversationId = currentConversationId;
      if (!targetConversationId) {
        targetConversationId = await createNewConversation();
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const targetConversation = conversations.find(
        (c) => c.id === targetConversationId
      );
      const updatedMessages = [
        ...(targetConversation?.messages || []),
        userMessage,
      ];

      // Update conversation with new user message
      const updatedConversations = conversations.map((conv) =>
        conv.id === targetConversationId
          ? { ...conv, messages: updatedMessages, updatedAt: new Date() }
          : conv
      );
      setConversations(updatedConversations);
      setIsLoading(true);

      try {
        const systemPrompt =
          targetConversation?.systemPrompt || IFS_SYSTEM_PROMPT;
        const conversationMessages: ModelMessage[] = [
          { role: "system", content: systemPrompt },
          ...updatedMessages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ];

        const provider = createProxyProvider();
        let fullResponse = "";

        for await (const chunk of provider.generateTextStream({
          messages: conversationMessages,
        })) {
          fullResponse += chunk.text;
          onChunk?.(chunk.text);
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: fullResponse,
          timestamp: new Date(),
        };

        const finalMessages = [...updatedMessages, assistantMessage];

        // Update conversation with assistant response
        const finalConversations = updatedConversations.map((conv) =>
          conv.id === targetConversationId
            ? {
                ...conv,
                messages: finalMessages,
                updatedAt: new Date(),
                title:
                  conv.messages.length === 0
                    ? generateConversationTitle(finalMessages)
                    : conv.title,
              }
            : conv
        );

        setConversations(finalConversations);
        await saveConversations(finalConversations);

        return fullResponse;
      } catch (error) {
        console.error("Failed to send message:", error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      conversations,
      currentConversationId,
      createProxyProvider,
      createNewConversation,
      saveConversations,
      generateConversationTitle,
    ]
  );

  const switchToConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const updatedConversations = conversations.filter(
        (c) => c.id !== conversationId
      );
      setConversations(updatedConversations);

      if (currentConversationId === conversationId) {
        setCurrentConversationId(
          updatedConversations.length > 0 ? updatedConversations[0].id : null
        );
      }

      await saveConversations(updatedConversations);
    },
    [conversations, currentConversationId, saveConversations]
  );

  const clearAllHistory = useCallback(async () => {
    setConversations([]);
    setCurrentConversationId(null);
    await AsyncStorage.removeItem("ifs_conversations");
  }, []);

  const renameConversation = useCallback(
    async (conversationId: string, newTitle: string) => {
      const updatedConversations = conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, title: newTitle, updatedAt: new Date() }
          : conv
      );
      setConversations(updatedConversations);
      await saveConversations(updatedConversations);
    },
    [conversations, saveConversations]
  );

  const updateConversationSystemPrompt = useCallback(
    async (conversationId: string, systemPrompt: string) => {
      const updatedConversations = conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, systemPrompt, updatedAt: new Date() }
          : conv
      );
      setConversations(updatedConversations);
      await saveConversations(updatedConversations);
    },
    [conversations, saveConversations]
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<ConversationSettings>) => {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await saveSettings(updated);
    },
    [settings, saveSettings]
  );

  return useMemo(
    () => ({
      conversations,
      currentConversation,
      currentConversationId,
      messages,
      isLoading,
      settings,
      sendMessage,
      sendMessageStream,
      createNewConversation,
      switchToConversation,
      deleteConversation,
      clearAllHistory,
      renameConversation,
      updateConversationSystemPrompt,
      updateSettings,
    }),
    [
      conversations,
      currentConversation,
      currentConversationId,
      messages,
      isLoading,
      settings,
      sendMessage,
      sendMessageStream,
      createNewConversation,
      switchToConversation,
      deleteConversation,
      clearAllHistory,
      renameConversation,
      updateConversationSystemPrompt,
      updateSettings,
    ]
  );
});
