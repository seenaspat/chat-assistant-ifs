import createContextHook from "@nkzw/create-context-hook";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: "google" | "apple";
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
  ios:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
  android:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
  web:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
};

const USER_STORAGE_KEY = "user_data";

export const [AuthProvider, useAuth] = createContextHook((): AuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Avoid popup redirect loops on web
  if (Platform.OS === "web") {
    WebBrowser.maybeCompleteAuthSession();
  }

  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  const redirectUri =
    Platform.OS === "web"
      ? AuthSession.makeRedirectUri({ preferLocalhost: true })
      : AuthSession.makeRedirectUri({ scheme: "myapp" });

  console.log(
    "[Auth] init",
    JSON.stringify(
      {
        platform: Platform.OS,
        redirectUri,
        GOOGLE_CLIENT_ID: {
          ios: !!GOOGLE_CLIENT_ID.ios,
          android: !!GOOGLE_CLIENT_ID.android,
          web: !!GOOGLE_CLIENT_ID.web,
        },
      },
      null,
      2
    )
  );

  const [, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.select(GOOGLE_CLIENT_ID) || GOOGLE_CLIENT_ID.web,
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType:
        Platform.OS === "web"
          ? (AuthSession.ResponseType.Token as const)
          : (AuthSession.ResponseType.Code as const),
      usePKCE: Platform.OS !== "web",
    },
    discovery
  );

  console.log("[Auth] discovery endpoints", discovery);

  const loadStoredUser = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        console.log("[Auth] checking localStorage for user_data");
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          console.log("[Auth] found stored user in localStorage");
          setUser(JSON.parse(storedUser));
        }
      } else {
        const storedUser = await SecureStore.getItemAsync(USER_STORAGE_KEY);
        if (storedUser) {
          console.log("[Auth] found stored user in SecureStore");
          setUser(JSON.parse(storedUser));
        }
      }
    } catch (error) {
      console.error("Error loading stored user:", error);
    } finally {
      console.log("[Auth] loadStoredUser done; setting isLoading=false");
      setIsLoading(false);
    }
  }, []);

  const storeUser = useCallback(async (userData: User) => {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      } else {
        await SecureStore.setItemAsync(
          USER_STORAGE_KEY,
          JSON.stringify(userData)
        );
      }
      setUser(userData);
    } catch (error) {
      console.error("Error storing user:", error);
    }
  }, []);

  const handleGoogleAuthSuccess = useCallback(
    async (accessToken?: string) => {
      console.log("[Auth] handleGoogleAuthSuccess", {
        hasAccessToken: !!accessToken,
      });
      if (!accessToken) return;

      try {
        setIsLoading(true);
        console.log("[Auth] fetching userinfo with access token");
        const userInfoResponse = await fetch(
          `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
        );
        const userInfo = await userInfoResponse.json();
        console.log("[Auth] userinfo response", userInfo);

        const userData: User = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          provider: "google",
        };

        await storeUser(userData);
      } catch (error) {
        console.error("Error fetching user info:", error);
      } finally {
        console.log("[Auth] handleGoogleAuthSuccess done; setIsLoading=false");
        setIsLoading(false);
      }
    },
    [storeUser]
  );

  // Load user from secure storage on app start
  useEffect(() => {
    console.log("[Auth] useEffect(loadStoredUser) running");
    loadStoredUser();
  }, [loadStoredUser]);

  // Handle Google OAuth response
  useEffect(() => {
    if (!response) return;
    console.log("[Auth] OAuth response", response);
    if (response.type === "success") {
      let token: string | undefined = response.authentication?.accessToken;
      if (!token && typeof response.url === "string") {
        try {
          const urlObj = new URL(response.url);
          const hash = urlObj.hash.startsWith("#")
            ? urlObj.hash.slice(1)
            : urlObj.hash;
          const hashParams = new URLSearchParams(hash);
          token =
            hashParams.get("access_token") ||
            urlObj.searchParams.get("access_token") ||
            undefined;
        } catch (e) {
          console.log("[Auth] failed to parse access_token from url", e);
        }
      }
      console.log("[Auth] extracted access token?", !!token);
      handleGoogleAuthSuccess(token);
    } else {
      // Ensure we clear loading state when user cancels/closes popup or on error
      console.log("[Auth] OAuth response non-success; setIsLoading=false");
      setIsLoading(false);
    }
  }, [response, handleGoogleAuthSuccess]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log("[Auth] signInWithGoogle -> promptAsync", {
        clientId: Platform.select(GOOGLE_CLIENT_ID) || GOOGLE_CLIENT_ID.web,
        redirectUri,
      });
      await promptAsync();
    } catch (error) {
      console.error("Google sign in error:", error);
      setIsLoading(false);
    }
  }, [promptAsync, redirectUri]);

  const signInWithApple = useCallback(async () => {
    try {
      setIsLoading(true);

      if (Platform.OS !== "ios") {
        console.log("Apple Sign-In is only available on iOS");
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
        email: credential.email || "No email provided",
        name: credential.fullName?.givenName
          ? `${credential.fullName.givenName} ${
              credential.fullName.familyName || ""
            }`.trim()
          : "Apple User",
        provider: "apple",
      };

      await storeUser(userData);
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        console.log("Apple Sign-In was canceled");
      } else {
        console.error("Apple sign in error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeUser]);

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log("[Auth] signOut start");
      if (Platform.OS === "web") {
        localStorage.removeItem(USER_STORAGE_KEY);
        console.log("[Auth] cleared localStorage", USER_STORAGE_KEY);
      } else {
        await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
        console.log("[Auth] cleared SecureStore", USER_STORAGE_KEY);
      }
      setUser(null);
      console.log("[Auth] user set to null");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoading(false);
      console.log("[Auth] signOut end");
    }
  }, []);

  return useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      signInWithGoogle,
      signInWithApple,
      signOut,
    }),
    [user, isLoading, signInWithGoogle, signInWithApple, signOut]
  );
});
