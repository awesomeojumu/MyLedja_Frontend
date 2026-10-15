import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { readPublicConfig } from "./src/config";

export default function App() {
  const config = readPublicConfig();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header">MyLedja</Text>
      <Text>{config.appEnv}</Text>
      <Text>{config.apiUrl}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
