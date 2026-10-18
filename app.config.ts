import type { ExpoConfig } from "expo/config";
import tokenFile from "./src/design/tokens.json";

const hero = tokenFile.color.tokens.find((token) => token.name === "hero")?.value.light;
if (!hero) {
  throw new Error("tokens.json is missing the hero colour");
}

const config: ExpoConfig = {
  name: "MyLedja",
  slug: "myledja",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  scheme: "myledja",
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: hero,
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-font",
    "expo-sqlite",
    "expo-notifications",
    [
      "expo-router",
      {
        root: "./app",
      },
    ],
  ],
};

export default config;
