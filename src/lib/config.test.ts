import { readPublicConfig } from "./config";

function assertEqual(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

const defaults = readPublicConfig({});
assertEqual(defaults.appEnv, "development");
assertEqual(defaults.apiUrl, "http://localhost:4000");

const staging = readPublicConfig({
  EXPO_PUBLIC_APP_ENV: "staging",
  EXPO_PUBLIC_API_URL: "https://staging.example.com",
});
assertEqual(staging.appEnv, "staging");
assertEqual(staging.apiUrl, "https://staging.example.com");
