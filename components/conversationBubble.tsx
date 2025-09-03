import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Message } from '@/providers/conversation-provider';
import { User, Bot } from 'lucide-react-native';

interface ConversationBubbleProps {
  message: Message;
  style?: ViewStyle;
}

export function ConversationBubble({ message, style }: ConversationBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer, style]}>
      <View style={styles.avatarContainer}>
        {isUser ? (
          <View style={styles.userAvatar}>
            <User color="#fff" size={16} />
          </View>
        ) : (
          <LinearGradient
            colors={['#4a9eff', '#6bb6ff']}
            style={styles.assistantAvatar}
          >
            <Bot color="#fff" size={16} />
          </LinearGradient>
        )}
      </View>
      
      <View style={styles.messageContainer}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
            {message.content}
          </Text>
        </View>
        <Text style={styles.timestamp}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginTop: 4,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContainer: {
    flex: 1,
    maxWidth: '80%',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 4,
  },
  userBubble: {
    backgroundColor: '#4a9eff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
});