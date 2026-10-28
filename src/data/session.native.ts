import * as SecureStore from 'expo-secure-store';
import type { SessionStore } from './session';

export type { SessionStore } from './session';
export { createMemorySessionStore } from './session';

const KEY = 'myledja.refreshToken';

type SecureApi = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;

export function createSecureSessionStore(secure: SecureApi = SecureStore): SessionStore {
  return {
    getRefreshToken: () => secure.getItemAsync(KEY),
    setRefreshToken: (token) => secure.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    async hasCookieSession() {
      return false;
    },
    async setCookieSession() {},
    clear: () => secure.deleteItemAsync(KEY),
  };
}

export function createSessionStore(): SessionStore {
  return createSecureSessionStore();
}
