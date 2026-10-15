import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DesignCatalog } from "./src/catalog/DesignCatalog";
import { ThemeProvider } from "./src/design";

export default function App() {
  const [ready] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider font="inter" haptics>
        <DesignCatalog />
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
