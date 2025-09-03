import { useEffect, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import createContextHook from '@nkzw/create-context-hook';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'apple';
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const GOOGLE_CLIENT_ID = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};

const USER_STORAGE_KEY = 'user_data';

export const [AuthProvider, useAuth] = createContextHook((): AuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

  const [, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.select(GOOGLE_CLIENT_ID) || GOOGLE_CLIENT_ID.web,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'myapp',
      }),
    },
    discovery
  );

  const loadStoredUser = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } else {
        const storedUser = await SecureStore.getItemAsync(USER_STORAGE_KEY);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const storeUser = useCallback(async (userData: User) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      } else {
        await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(userData));
      }
      setUser(userData);
    } catch (error) {
      console.error('Error storing user:', error);
    }
  }, []);

  const handleGoogleAuthSuccess = useCallback(async (accessToken?: string) => {
    if (!accessToken) return;

    try {
      setIsLoading(true);
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );
      const userInfo = await userInfoResponse.json();

      const userData: User = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        provider: 'google',
      };

      await storeUser(userData);
    } catch (error) {
      console.error('Error fetching user info:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storeUser]);

  // Load user from secure storage on app start
  useEffect(() => {
    loadStoredUser();
  }, [loadStoredUser]);

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleAuthSuccess(response.authentication?.accessToken);
    }
  }, [response, handleGoogleAuthSuccess]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
      await promptAsync();
    } catch (error) {
      console.error('Google sign in error:', error);
      setIsLoading(false);
    }
  }, [promptAsync]);

  const signInWithApple = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (Platform.OS !== 'ios') {
        console.log('Apple Sign-In is only available on iOS');
        setIsLoading(false);
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const userData: User = {
        id: credential.user,
        email: credential.email || 'No email provided',
        name: credential.fullName?.givenName 
          ? `${credential.fullName.givenName} ${credential.fullName.familyName || ''}`.trim()
          : 'Apple User',
        provider: 'apple',
      };

      await storeUser(userData);
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('Apple Sign-In was canceled');
      } else {
        console.error('Apple sign in error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeUser]);

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      if (Platform.OS === 'web') {
        localStorage.removeItem(USER_STORAGE_KEY);
      } else {
        await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
      }
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithGoogle,
    signInWithApple,
    signOut,
  }), [user, isLoading, signInWithGoogle, signInWithApple, signOut]);
});