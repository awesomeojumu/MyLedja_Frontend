import { createMemorySessionStore, type SessionStore } from './session.shared';

export type { SessionStore } from './session.shared';
export { createMemorySessionStore } from './session.shared';

/** Web: the refresh token stays in memory; only the "Stay signed in" flag is remembered. */
export function createSessionStore(): SessionStore {
  const storage = typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
  return createMemorySessionStore(storage);
}
