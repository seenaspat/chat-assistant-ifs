import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Alert,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Settings, History, Edit3, LogOut } from 'lucide-react-native';
import { useConversation } from '@/providers/conversation-provider';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useAuth } from '@/providers/auth-provider';
import { VoiceOrb } from '@/components/voiceOrb';
import { ConversationBubble } from '@/components/conversationBubble';
import SystemPromptEditor from '@/components/systemPromptEditor';
import AuthGuard from '@/components/auth-guard';

const { height } = Dimensions.get('window');

export default function HomeScreen() {
  const { messages, sendMessage, isLoading, settings, createNewConversation, currentConversation } = useConversation();
  const { isRecording, startRecording, stopRecording } = useAudioRecording();
  const { speak, isSpeaking, stop: stopSpeaking } = useTextToSpeech();
  const { signOut, user } = useAuth();
  const [isListening, setIsListening] = useState<boolean>(false);
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState<boolean>(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const drawerPosition = useRef(new Animated.Value(height * 0.7)).current;
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (isRecording || isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, isListening, pulseAnim]);

  useEffect(() => {
    if (!settings.voiceActivation) return;
    if (isRecording || isSpeaking || isListening || isLoading) return;
    const start = async () => {
      try {
        console.log('[VoiceActivation] attempting to start recording');
        await startRecording();
      } catch (e) {
        console.log('[VoiceActivation] start failed', e);
      }
    };
    start();
  }, [settings.voiceActivation, isRecording, isSpeaking, isListening, isLoading, startRecording]);

  const handlePress = async () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    if (isRecording) {
      setIsListening(true);
      try {
        const transcript = await stopRecording();
        setIsListening(false);
        
        if (transcript) {
          const response = await sendMessage(transcript);
          if (response && settings.autoPlayResponses) {
            speak(response, settings.useElevenLabs);
          }
          // Auto-scroll to bottom after new message
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } catch {
        setIsListening(false);
        Alert.alert('Error', 'Failed to process audio. Please try again.');
      }
    } else {
      try {
        await startRecording();
      } catch {
        Alert.alert('Permission Required', 'Please allow microphone access to use voice features.');
      }
    }
  };

  const getStatusText = () => {
    if (isSpeaking) return 'Speaking...';
    if (isListening) return 'Processing...';
    if (isRecording) return 'Listening...';
    if (isLoading) return 'Thinking...';
    return 'Tap anywhere to Speak';
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        (drawerPosition as any).setOffset((drawerPosition as any)._value);
        drawerPosition.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        drawerPosition.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        (drawerPosition as any).flattenOffset();
        
        const velocity = gestureState.vy;
        const threshold = height * 0.3;
        
        let targetPosition: number;
        
        if (velocity > 0.5 || (velocity > -0.5 && gestureState.dy > threshold)) {
          targetPosition = height * 0.7;
        } else {
          targetPosition = height * 0.1;
        }
        
        Animated.spring(drawerPosition, {
          toValue: targetPosition,
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }).start();
      },
    })
  ).current;



  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          }
        },
      ]
    );
  };

  return (
    <AuthGuard>
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          style={styles.gradient}
        >
          <StatusBar style="light" />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Pressable
                style={styles.headerButton}
                onPress={() => router.push('/history')}
                testID="history-button"
              >
                <History color="#fff" size={24} />
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>IFS Therapy</Text>
                {user && (
                  <Text style={styles.userGreeting}>Hello, {user.name.split(' ')[0]}</Text>
                )}
                {currentConversation && (
                  <View style={styles.headerSubtitleContainer}>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      {currentConversation.title}
                    </Text>
                    {messages.length === 0 && (
                      <Pressable
                        style={styles.editPromptButton}
                        onPress={() => setShowSystemPromptEditor(true)}
                        testID="edit-system-prompt-button"
                      >
                        <Edit3 size={14} color="#4ade80" />
                        <Text style={styles.editPromptText}>Edit Prompt</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.headerRight}>
                <Pressable
                  style={styles.newConversationButton}
                  onPress={() => createNewConversation()}
                  testID="new-conversation-button"
                >
                  <Text style={styles.newConversationText}>New</Text>
                </Pressable>
                <Pressable
                  style={styles.headerButton}
                  onPress={() => router.push('/settings')}
                  testID="settings-button"
                >
                  <Settings color="#fff" size={24} />
                </Pressable>
                <Pressable
                  style={styles.headerButton}
                  onPress={handleSignOut}
                  testID="sign-out-button"
                >
                  <LogOut color="#fff" size={24} />
                </Pressable>
              </View>
            </View>

          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <View style={styles.conversationBackground}>
              <ScrollView 
                ref={scrollViewRef}
                style={styles.conversationScrollView}
                contentContainerStyle={styles.conversationContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
              >
                {messages.map((message, index) => (
                  <ConversationBubble
                    key={index}
                    message={message}
                    style={styles.messageItem}
                  />
                ))}
              </ScrollView>
            </View>

            <Animated.View 
              style={[
                styles.drawerContainer,
                {
                  transform: [{ translateY: drawerPosition }],
                }
              ]}
              {...panResponder.panHandlers}
            >
              <View style={styles.drawerHandle} />
              
              <Pressable 
                style={styles.voiceSection} 
                onPress={handlePress} 
                testID="voice-pressable"
                disabled={isDragging}
              >
                <View style={styles.voiceContent}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <VoiceOrb
                      isActive={isRecording || isListening || isSpeaking}
                      isRecording={isRecording}
                      isSpeaking={isSpeaking}
                    />
                  </Animated.View>
                  
                  <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
      
      {currentConversation && (
        <SystemPromptEditor
          visible={showSystemPromptEditor}
          onClose={() => setShowSystemPromptEditor(false)}
          conversationId={currentConversation.id}
          initialPrompt={currentConversation.systemPrompt}
        />
      )}
      </View>
    </AuthGuard>
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
  },
  headerButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  userGreeting: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  headerSubtitleContainer: {
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    maxWidth: 200,
  },
  editPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    marginTop: 4,
    gap: 4,
  },
  editPromptText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newConversationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  newConversationText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  conversationBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  conversationScrollView: {
    flex: 1,
  },
  conversationContent: {
    paddingBottom: height * 0.3,
    flexGrow: 1,
  },
  messageItem: {
    marginBottom: 12,
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  drawerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  voiceSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});