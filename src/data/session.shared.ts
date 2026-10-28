/**
 * Where the long-lived sign-in is kept (TECH-SPEC 10, DESIGN.md 10.6).
 * Phones: the refresh token in Keychain / Keystore (session.native.ts).
 * Web: memory only, or the HttpOnly cookie when "Stay signed in" is ticked. Scripts never see the cookie;
 * we only remember that one was asked for.
 */
export interface SessionStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  hasCookieSession(): Promise<boolean>;
  setCookieSession(on: boolean): Promise<void>;
  clear(): Promise<void>;
}

const COOKIE_FLAG = 'myledja.staySignedIn';

export function createMemorySessionStore(flagStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): SessionStore {
  let refresh: string | null = null;
  return {
    async getRefreshToken() {
      return refresh;
    },
    async setRefreshToken(token) {
      refresh = token;
    },
    async hasCookieSession() {
      return flagStorage?.getItem(COOKIE_FLAG) === '1';
    },
    async setCookieSession(on) {
      if (on) flagStorage?.setItem(COOKIE_FLAG, '1');
      else flagStorage?.removeItem(COOKIE_FLAG);
    },
    async clear() {
      refresh = null;
      flagStorage?.removeItem(COOKIE_FLAG);
    },
  };
}
