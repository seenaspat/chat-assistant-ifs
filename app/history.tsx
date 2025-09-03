import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useConversation } from '@/providers/conversation-provider';
import { ConversationBubble } from '@/components/conversationBubble';
import { 
  Trash2, 
  Plus, 
  MessageCircle, 
  Edit3, 
  Check, 
  X, 
  ArrowLeft 
} from 'lucide-react-native';

export default function HistoryScreen() {
  const { 
    conversations, 
    currentConversationId,
    createNewConversation, 
    switchToConversation, 
    deleteConversation, 
    clearAllHistory,
    renameConversation 
  } = useConversation();
  
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  const sortedConversations = conversations.sort((a, b) => 
    b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  const handleCreateNew = async () => {
    try {
      await createNewConversation();
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create new conversation');
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    if (selectedConversation === conversationId) {
      setSelectedConversation(null);
    } else {
      setSelectedConversation(conversationId);
    }
  };

  const handleSwitchToConversation = (conversationId: string) => {
    switchToConversation(conversationId);
    router.back();
  };

  const handleDeleteConversation = (conversationId: string) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteConversation(conversationId)
        }
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all conversations? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: clearAllHistory
        }
      ]
    );
  };

  const startEditing = (conversationId: string, currentTitle: string) => {
    setEditingId(conversationId);
    setEditTitle(currentTitle);
  };

  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (selectedConversation) {
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (!conversation) {
      setSelectedConversation(null);
      return null;
    }

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          style={styles.gradient}
        >
          <StatusBar style="light" />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Pressable 
                style={styles.backButton} 
                onPress={() => setSelectedConversation(null)}
              >
                <ArrowLeft color="#fff" size={24} />
              </Pressable>
              <Text style={styles.title} numberOfLines={1}>
                {conversation.title}
              </Text>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.headerButton}
                  onPress={() => handleSwitchToConversation(conversation.id)}
                >
                  <Text style={styles.switchButtonText}>Switch</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.messagesContainer}>
                {conversation.messages.map((message, index) => (
                  <ConversationBubble
                    key={index}
                    message={message}
                    style={styles.messageItem}
                  />
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>Conversations</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.newButton} onPress={handleCreateNew}>
                <Plus color="#fff" size={20} />
                <Text style={styles.newButtonText}>New</Text>
              </Pressable>
              {conversations.length > 0 && (
                <Pressable style={styles.clearButton} onPress={handleClearAll}>
                  <Trash2 color="#ff6b6b" size={20} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {conversations.length === 0 ? (
              <View style={styles.emptyState}>
                <MessageCircle color="rgba(255, 255, 255, 0.3)" size={64} />
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>
                  Start a conversation to see your history here
                </Text>
                <Pressable style={styles.startButton} onPress={handleCreateNew}>
                  <Text style={styles.startButtonText}>Start Conversation</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.conversationsList}>
                {sortedConversations.map((conversation) => (
                  <View key={conversation.id} style={styles.conversationCard}>
                    <Pressable
                      style={[
                        styles.conversationItem,
                        currentConversationId === conversation.id && styles.currentConversation
                      ]}
                      onPress={() => handleSelectConversation(conversation.id)}
                    >
                      <View style={styles.conversationHeader}>
                        {editingId === conversation.id ? (
                          <View style={styles.editContainer}>
                            <TextInput
                              style={styles.editInput}
                              value={editTitle}
                              onChangeText={setEditTitle}
                              placeholder="Conversation title"
                              placeholderTextColor="rgba(255, 255, 255, 0.5)"
                              autoFocus
                            />
                            <View style={styles.editActions}>
                              <Pressable style={styles.editButton} onPress={saveEdit}>
                                <Check color="#4ade80" size={16} />
                              </Pressable>
                              <Pressable style={styles.editButton} onPress={cancelEdit}>
                                <X color="#f87171" size={16} />
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={styles.conversationInfo}>
                              <Text style={styles.conversationTitle} numberOfLines={1}>
                                {conversation.title}
                              </Text>
                              <Text style={styles.conversationMeta}>
                                {conversation.messages.length} messages • {formatDate(conversation.updatedAt)}
                              </Text>
                            </View>
                            <View style={styles.conversationActions}>
                              <Pressable
                                style={styles.actionButton}
                                onPress={() => startEditing(conversation.id, conversation.title)}
                              >
                                <Edit3 color="rgba(255, 255, 255, 0.6)" size={16} />
                              </Pressable>
                              <Pressable
                                style={styles.actionButton}
                                onPress={() => handleDeleteConversation(conversation.id)}
                              >
                                <Trash2 color="#ff6b6b" size={16} />
                              </Pressable>
                            </View>
                          </>
                        )}
                      </View>
                      
                      {conversation.messages.length > 0 && (
                        <Text style={styles.lastMessage} numberOfLines={2}>
                          {conversation.messages[conversation.messages.length - 1].content}
                        </Text>
                      )}
                    </Pressable>
                    
                    <View style={styles.conversationFooter}>
                      <Pressable
                        style={[
                          styles.switchButton,
                          currentConversationId === conversation.id && styles.currentButton
                        ]}
                        onPress={() => handleSwitchToConversation(conversation.id)}
                      >
                        <Text style={[
                          styles.switchButtonText,
                          currentConversationId === conversation.id && styles.currentButtonText
                        ]}>
                          {currentConversationId === conversation.id ? 'Current' : 'Switch'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  newButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  startButtonText: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '500',
  },
  conversationsList: {
    padding: 20,
    gap: 16,
  },
  conversationCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  conversationItem: {
    padding: 16,
  },
  currentConversation: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  conversationInfo: {
    flex: 1,
    marginRight: 12,
  },
  conversationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  conversationMeta: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  conversationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  lastMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    lineHeight: 18,
  },
  conversationFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-start',
  },
  currentButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  switchButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  currentButtonText: {
    color: '#4ade80',
  },
  messagesContainer: {
    padding: 20,
    gap: 16,
  },
  messageItem: {
    marginBottom: 0,
  },
});