import * as SecureStore from 'expo-secure-store';
import type { SessionStore } from './session.shared';

export type { SessionStore } from './session.shared';
export { createMemorySessionStore } from './session.shared';

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
