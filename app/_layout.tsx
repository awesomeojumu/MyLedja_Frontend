import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/design";
import { installDurableCache } from "@/lib/durable-kv";
import { useBillReminders } from "@/notifications/use-bill-reminders";
import { SchemeProvider, SessionProvider, useScheme } from "@/state";

installDurableCache();

export const unstable_settings = {
  initialRouteName: "(auth)",
};

function ThemedStack() {
  const [ready] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const { scheme, haptics } = useScheme();
  useBillReminders();

  return (
    <ThemeProvider font={ready ? "inter" : "system"} haptics={haptics} scheme={scheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="catalog" />
      </Stack>
      <StatusBar style={scheme === "dark" ? "light" : scheme === "light" ? "dark" : "auto"} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SchemeProvider>
        <SessionProvider>
          <ThemedStack />
        </SessionProvider>
      </SchemeProvider>
    </SafeAreaProvider>
  );
}
