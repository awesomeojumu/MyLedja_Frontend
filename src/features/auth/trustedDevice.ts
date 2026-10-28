import { openKeyValue } from '@/data/kv';

/** "Trust this device for 30 days": the token two-factor gave this device, per email. Kept across sign-outs. */
let store: ReturnType<typeof openKeyValue> | null = null;
const kv = () => (store ??= openKeyValue('myledja-device'));
const key = (email: string) => `trusted:${email.trim().toLowerCase()}`;

export async function trustedDeviceToken(email: string): Promise<string | undefined> {
  // Storage trouble must never block signing in; without a token the code is simply asked for.
  try {
    return (await kv().get(key(email))) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function rememberTrustedDevice(email: string, token: string | null): Promise<void> {
  if (!token) return;
  try {
    await kv().set([[key(email), token]]);
  } catch {
    // Not remembered: two-factor is asked again next time, which is safe.
  }
}
