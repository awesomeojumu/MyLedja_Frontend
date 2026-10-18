import { Platform } from "react-native";
import { setKeyValueBackend, type KeyValue } from "@/lib/offline-cache";

function webKeyValue(): KeyValue | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return {
    get: (key) => globalThis.localStorage.getItem(key),
    set: (key, value) => globalThis.localStorage.setItem(key, value),
    remove: (key) => globalThis.localStorage.removeItem(key),
  };
}

function deviceKeyValue(): KeyValue | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Storage } = require("expo-sqlite/kv-store") as typeof import("expo-sqlite/kv-store");
    return {
      get: (key) => Storage.getItemSync(key),
      set: (key, value) => Storage.setItemSync(key, value),
      remove: (key) => {
        Storage.removeItemSync(key);
      },
    };
  } catch {
    return null;
  }
}

/** Phones keep the cache in SQLite so it survives an app kill; the web build uses localStorage. */
export function installDurableCache(): void {
  const store = Platform.OS === "web" ? webKeyValue() : deviceKeyValue();
  if (store) setKeyValueBackend(store);
}
