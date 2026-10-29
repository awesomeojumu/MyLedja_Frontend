import { Platform } from 'react-native';
import { ApiError, NetworkError } from '@/api/client';
import type { AuthApi, SignInResponse } from '@/api/auth';
import { obtainGoogleIdToken } from './googleIdToken';

export type GooglePublicConfig = {
  enabled: boolean;
  clientId: string | null;
};

let cached: GooglePublicConfig | null = null;

/** Pending Google link after 409 google_link_needed (TECH-SPEC 5.8). Sign-in may consume this. */
let pendingGoogleLink: { email: string; linkToken: string } | null = null;

export function peekGoogleLinkPending(): { email: string; linkToken: string } | null {
  return pendingGoogleLink;
}

export function takeGoogleLinkPending(): { email: string; linkToken: string } | null {
  const next = pendingGoogleLink;
  pendingGoogleLink = null;
  return next;
}

export function setGoogleLinkPending(email: string, linkToken: string): void {
  pendingGoogleLink = { email, linkToken };
}

/** Clears the public-config cache (tests). */
export function resetGoogleSignInCache(): void {
  cached = null;
  pendingGoogleLink = null;
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
  | { ok: true; session: SignInResponse; staySignedIn: boolean }
  | {
      ok: false;
      reason: 'cancelled' | 'unavailable' | 'link_password' | 'network';
      message?: string;
      email?: string;
      linkToken?: string;
    };

export type RunGoogleSignInOptions = {
  staySignedIn?: boolean;
  deviceName?: string;
  trustedDeviceToken?: string;
};

/**
 * Starts Google sign-in once public-config has enabled it (T0.2 / B0.8).
 * Obtains an ID token (GIS web / auth-session native), then POST /v1/auth/google.
 */
export async function runGoogleSignIn(
  api: AuthApi,
  options: RunGoogleSignInOptions = {},
): Promise<GoogleSignInResult> {
  const google = await loadGoogleSignIn(api);
  if (!google.enabled || !google.clientId) return { ok: false, reason: 'unavailable' };

  const token = await obtainGoogleIdToken(google.clientId);
  if (!token.ok) return { ok: false, reason: token.reason };

  const staySignedIn = Platform.OS === 'web' && Boolean(options.staySignedIn);
  try {
    const session = await api.signInWithGoogle({
      idToken: token.idToken,
      staySignedIn,
      ...(options.deviceName ? { deviceName: options.deviceName } : {}),
      ...(options.trustedDeviceToken ? { trustedDeviceToken: options.trustedDeviceToken } : {}),
    });
    return { ok: true, session, staySignedIn };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.body.code === 'google_link_needed') {
      const body = e.body as ApiError['body'] & { email?: string; linkToken?: string };
      if (body.email && body.linkToken) setGoogleLinkPending(body.email, body.linkToken);
      return {
        ok: false,
        reason: 'link_password',
        email: body.email,
        linkToken: body.linkToken,
      };
    }
    if (e instanceof ApiError && (e.status === 404 || e.body.code === 'google_off' || e.body.code === 'google_refused')) {
      return { ok: false, reason: 'unavailable' };
    }
    if (e instanceof NetworkError) return { ok: false, reason: 'network' };
    if (e instanceof ApiError) return { ok: false, reason: 'network', message: e.body.message };
    return { ok: false, reason: 'unavailable' };
  }
}
