import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { memoryTokenStore, type TokenStore } from "@/lib/session-core";

const KEY = "myledja.refreshToken";

/**
 * iOS Keychain / Android Keystore via expo-secure-store, readable only while the device is unlocked and never
 * synced to other devices. The web build keeps the token in memory only, never in localStorage.
 */
export function secureTokenStore(): TokenStore {
  if (Platform.OS === "web") {
    return memoryTokenStore();
  }
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return {
    get: () => SecureStore.getItemAsync(KEY, options),
    set: (token) => SecureStore.setItemAsync(KEY, token, options),
    clear: () => SecureStore.deleteItemAsync(KEY, options),
  };
}
