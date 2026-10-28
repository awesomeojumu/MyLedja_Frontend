import { Platform } from 'react-native';
import type { SessionResponse } from '@/api/auth';
import type { AuthApi } from '@/api/auth';

/** Hidden until prototype T0.2 supplies a client id (docs/QUESTIONS.md Q-6). */
export function googleSignInEnabled(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim());
}

export type GoogleSignInResult =
  | { ok: true; session: SessionResponse; staySignedIn: boolean }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'link_password' | 'network'; message?: string };

/**
 * Starts Google sign-in. Web uses the public client id when set; native uses expo-auth-session in a later slice.
 * Until GIS / auth-session is wired, returns unavailable when no id token can be obtained.
 */
export async function runGoogleSignIn(_api: AuthApi): Promise<GoogleSignInResult> {
  if (!googleSignInEnabled()) return { ok: false, reason: 'unavailable' };
  if (Platform.OS !== 'web') return { ok: false, reason: 'unavailable' };
  return { ok: false, reason: 'unavailable' };
}
