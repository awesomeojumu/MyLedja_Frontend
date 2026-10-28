import { Platform } from 'react-native';
import type { AuthApi, SessionResponse } from '@/api/auth';

export type GooglePublicConfig = {
  enabled: boolean;
  clientId: string | null;
};

let cached: GooglePublicConfig | null = null;

/** Clears the public-config cache (tests). */
export function resetGoogleSignInCache(): void {
  cached = null;
}

/**
 * Loads whether Google sign-in is on from GET /v1/public-config (TECH-SPEC 2.3 / Q-B5).
 * No EXPO_PUBLIC_GOOGLE_* — client id stays on the server and is exposed as public config only.
 */
export async function loadGoogleSignIn(api: AuthApi): Promise<GooglePublicConfig> {
  if (cached) return cached;
  try {
    const cfg = await api.publicConfig();
    const clientId = cfg.google.clientId?.trim() || null;
    cached = { enabled: Boolean(cfg.google.enabled && clientId), clientId };
  } catch {
    cached = { enabled: false, clientId: null };
  }
  return cached;
}

/** Last loaded public-config result; false until `loadGoogleSignIn` succeeds with Google on. */
export function googleSignInEnabled(): boolean {
  return Boolean(cached?.enabled);
}

export function googleClientId(): string | null {
  return cached?.clientId ?? null;
}

export type GoogleSignInResult =
  | { ok: true; session: SessionResponse; staySignedIn: boolean }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'link_password' | 'network'; message?: string };

/**
 * Starts Google sign-in once public-config has enabled it.
 * Until GIS / auth-session is wired (T0.2), returns unavailable when no id token can be obtained.
 */
export async function runGoogleSignIn(api: AuthApi): Promise<GoogleSignInResult> {
  const google = await loadGoogleSignIn(api);
  if (!google.enabled || !google.clientId) return { ok: false, reason: 'unavailable' };
  if (Platform.OS !== 'web') return { ok: false, reason: 'unavailable' };
  return { ok: false, reason: 'unavailable' };
}
