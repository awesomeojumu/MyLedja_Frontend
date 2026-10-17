import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { memoryTokenStore, type TokenStore } from "@/lib/session-core";

const KEY = "myledja.refreshToken";

function webTokenStore(): TokenStore {
  return {
    get: async () => {
      try {
        return globalThis.localStorage?.getItem(KEY) ?? null;
      } catch {
        return null;
      }
    },
    set: async (token) => {
      try {
        globalThis.localStorage?.setItem(KEY, token);
      } catch {
        /* private mode */
      }
    },
    clear: async () => {
      try {
        globalThis.localStorage?.removeItem(KEY);
      } catch {
        /* private mode */
      }
    },
  };
}

/**
 * iOS Keychain / Android Keystore via expo-secure-store, readable only while the device is unlocked and never
 * synced to other devices. Web keeps the refresh token in localStorage so a reload stays signed in.
 */
export function secureTokenStore(): TokenStore {
  if (Platform.OS === "web") {
    return typeof globalThis.localStorage === "undefined" ? memoryTokenStore() : webTokenStore();
  }
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return {
    get: () => SecureStore.getItemAsync(KEY, options),
    set: (token) => SecureStore.setItemAsync(KEY, token, options),
    clear: () => SecureStore.deleteItemAsync(KEY, options),
  };
}
