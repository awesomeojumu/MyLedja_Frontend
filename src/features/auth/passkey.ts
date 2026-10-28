import { Platform } from 'react-native';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';

/**
 * Passkeys through WebAuthn on web (DESIGN.md 10, TECH-SPEC 10). Phones need a native passkey module and the
 * web domain's association files (prototype T0.1), so the button stays hidden there until that's proven.
 */
export function passkeysAvailable(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && browserSupportsWebAuthn();
}

export async function passkeyAssertion(options: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await startAuthentication({ optionsJSON: options as never })) as unknown as Record<string, unknown>;
}

export async function passkeyRegistration(options: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await startRegistration({ optionsJSON: options as never })) as unknown as Record<string, unknown>;
}
