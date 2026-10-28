import { openKeyValue } from '@/data/kv';

/** "Trust this device for 30 days": the token two-factor gave this device, per email. Kept across sign-outs. */
const kv = openKeyValue('myledja-device');
const key = (email: string) => `trusted:${email.trim().toLowerCase()}`;

export async function trustedDeviceToken(email: string): Promise<string | undefined> {
  return (await kv.get(key(email))) ?? undefined;
}

export async function rememberTrustedDevice(email: string, token: string | null): Promise<void> {
  if (token) await kv.set([[key(email), token]]);
}
