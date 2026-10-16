import { readPublicConfig, resolveApiUrl } from "./config";

function assertEqual(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

const defaults = readPublicConfig({});
assertEqual(defaults.appEnv, "development");
assertEqual(defaults.apiUrl, "http://localhost:4000");
assertEqual(defaults.monoPublicKey, "");

const staging = readPublicConfig({
  EXPO_PUBLIC_APP_ENV: "staging",
  EXPO_PUBLIC_API_URL: "https://staging.example.com",
  EXPO_PUBLIC_MONO_PUBLIC_KEY: "test_pk_example",
});
assertEqual(staging.appEnv, "staging");
assertEqual(staging.apiUrl, "https://staging.example.com");
assertEqual(staging.monoPublicKey, "test_pk_example");

assertEqual(resolveApiUrl("http://localhost:4000", "192.168.1.20:8081"), "http://192.168.1.20:4000");
assertEqual(resolveApiUrl("http://127.0.0.1:4000/", "10.0.0.5:8081"), "http://10.0.0.5:4000/");
assertEqual(resolveApiUrl("http://localhost:4000", null), "http://localhost:4000");
assertEqual(resolveApiUrl("http://localhost:4000", "localhost:8081"), "http://localhost:4000");
assertEqual(resolveApiUrl("https://api.example.com", "192.168.1.20:8081"), "https://api.example.com");
console.log("config: env and device API URL");
