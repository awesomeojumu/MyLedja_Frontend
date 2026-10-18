import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { memoryTokenStore, type Identity, type TokenStore } from "@/lib/session-core";

const KEY = "myledja.refreshToken";
const IDENTITY_KEY = "myledja.session.identity";

function readIdentity(): Identity | null {
  try {
    const raw = globalThis.localStorage?.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

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
        globalThis.localStorage?.removeItem(IDENTITY_KEY);
      } catch {
        /* private mode */
      }
    },
    getIdentity: async () => readIdentity(),
    setIdentity: async (identity) => {
      try {
        globalThis.localStorage?.setItem(IDENTITY_KEY, JSON.stringify(identity));
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
    clear: async () => {
      await SecureStore.deleteItemAsync(KEY, options);
      await SecureStore.deleteItemAsync(IDENTITY_KEY, options);
    },
    getIdentity: async () => {
      const raw = await SecureStore.getItemAsync(IDENTITY_KEY, options);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as Identity;
      } catch {
        return null;
      }
    },
    setIdentity: (identity) => SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(identity), options),
  };
}
