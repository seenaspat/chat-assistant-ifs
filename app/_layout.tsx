import { AuthProvider } from "@/providers/auth-provider";
import { ConversationProvider } from "@/providers/conversation-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          title: "Conversation History",
          headerStyle: { backgroundColor: "#1a1a2e" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: "Settings",
          headerStyle: { backgroundColor: "#1a1a2e" },
          headerTintColor: "#fff",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const hide = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.log("Error hiding splash screen:", error);
      }
    };
    hide();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ConversationProvider>
            <RootLayoutNav />
          </ConversationProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
