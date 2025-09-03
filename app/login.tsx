import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/providers/auth-provider';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple, isLoading } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (error) {
      console.error('Google sign in failed:', error);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      router.replace('/');
    } catch (error) {
      console.error('Apple sign in failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.subtitle}>
              Sign in to access your conversations
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#333" />
              ) : (
                <>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            {Platform.OS !== 'ios' && (
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.disclaimer}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  googleButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
  },
  appleButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  disclaimer: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 16,
  },
});