import { Platform } from 'react-native';
import { AuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

export type ObtainGoogleIdTokenResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: 'cancelled' | 'unavailable' };

type GisCredentialResponse = { credential: string };
type GisPromptNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
};

type GisAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GisCredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: (momentListener?: (notification: GisPromptNotification) => void) => void;
  cancel: () => void;
};

function gisId(): GisAccountsId | null {
  if (typeof globalThis === 'undefined') return null;
  const g = (globalThis as { google?: { accounts?: { id?: GisAccountsId } } }).google;
  return g?.accounts?.id ?? null;
}

let gisScriptPromise: Promise<boolean> | null = null;

/** Loads Google Identity Services on web (DESIGN / T0.2). */
function loadGisScript(): Promise<boolean> {
  if (Platform.OS !== 'web') return Promise.resolve(false);
  if (gisId()) return Promise.resolve(true);
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-myledja-gis="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(gisId())));
      existing.addEventListener('error', () => resolve(false));
      if (gisId()) resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.myledjaGis = '1';
    script.onload = () => resolve(Boolean(gisId()));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

async function obtainViaGis(clientId: string): Promise<ObtainGoogleIdTokenResult> {
  const loaded = await loadGisScript();
  const id = gisId();
  if (!loaded || !id) return { ok: false, reason: 'unavailable' };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ObtainGoogleIdTokenResult) => {
      if (settled) return;
      settled = true;
      try {
        id.cancel();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    id.initialize({
      client_id: clientId,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (response?.credential) finish({ ok: true, idToken: response.credential });
        else finish({ ok: false, reason: 'unavailable' });
      },
    });

    id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
        // One Tap closed — fall through to auth-session popup below via reject path.
        finish({ ok: false, reason: 'cancelled' });
      }
    });
  });
}

async function obtainViaAuthSession(clientId: string): Promise<ObtainGoogleIdTokenResult> {
  try {
    const redirectUri = makeRedirectUri({
      native: 'myledja://oauthredirect',
    });
    const nonce = (
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${Date.now()}-${Math.random()}`)
    ).slice(0, 32);
    const request = new AuthRequest({
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: ResponseType.IdToken,
      usePKCE: false,
      extraParams: { nonce },
    });
    const result = await request.promptAsync(Google.discovery);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, reason: 'cancelled' };
    }
    if (result.type !== 'success') return { ok: false, reason: 'unavailable' };
    const idToken = result.params.id_token;
    if (!idToken) return { ok: false, reason: 'unavailable' };
    return { ok: true, idToken };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * Obtains a Google ID token for POST /v1/auth/google (T0.2).
 * Web prefers GIS One Tap; falls back to auth-session. Native uses auth-session.
 */
export async function obtainGoogleIdToken(clientId: string): Promise<ObtainGoogleIdTokenResult> {
  if (!clientId.trim()) return { ok: false, reason: 'unavailable' };

  if (Platform.OS === 'web') {
    const gis = await obtainViaGis(clientId);
    if (gis.ok) return gis;
    if (gis.reason === 'cancelled') {
      // User dismissed One Tap — try the full auth-session popup so the custom button still works.
      return obtainViaAuthSession(clientId);
    }
    return obtainViaAuthSession(clientId);
  }

  return obtainViaAuthSession(clientId);
}
