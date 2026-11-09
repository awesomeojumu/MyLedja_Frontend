import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AuthApi, SessionResponse } from '@/api/auth';

export type AppleSignInResult =
  | { ok: true; session: SessionResponse }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'network'; message?: string };

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function runAppleSignIn(
  api: AuthApi,
  opts: { staySignedIn?: boolean; trustedDeviceToken?: string } = {},
): Promise<AppleSignInResult> {
  if (Platform.OS !== 'ios') {
    return { ok: false, reason: 'unavailable', message: 'Apple Sign-In is only available on iOS' };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, reason: 'unavailable', message: 'No identity token received from Apple' };
    }

    const name =
      [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') ||
      'Apple User';

    const res = await api.signInWithApple({
      identityToken: credential.identityToken,
      email: credential.email ?? undefined,
      name,
      staySignedIn: opts.staySignedIn,
    });

    // If session returned or 2FA challenge returned
    return { ok: true, session: res as SessionResponse };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'network', message: 'Unable to sign in with Apple' };
  }
}
