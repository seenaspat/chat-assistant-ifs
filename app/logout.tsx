import { useAuth } from "@/providers/auth-provider";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function LogoutScreen() {
  const { signOut } = useAuth();
  const [status, setStatus] = useState<string>("Signing you out...");

  useEffect(() => {
    const run = async () => {
      try {
        await signOut();
        setStatus("Signed out. Redirecting...");
        router.replace("/login");
      } catch (e: any) {
        setStatus(`Sign out failed: ${e?.message || "Unknown error"}`);
      }
    };
    run();
  }, [signOut]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
      <Pressable
        style={styles.button}
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      >
        <Text style={styles.buttonText}>Sign out now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    padding: 24,
  },
  text: {
    color: "#fff",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
