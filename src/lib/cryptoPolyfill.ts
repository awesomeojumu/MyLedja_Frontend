import { getRandomValues } from 'expo-crypto';

type RandomSource = {
  getRandomValues: <T extends ArrayBufferView | null>(array: T) => T;
};

/** Hermes has no global crypto. uuid calls crypto.getRandomValues while sync starts. */
export function installWebCrypto(host: object = globalThis): void {
  try {
    const target = host as { crypto?: RandomSource };
    let ready = false;
    try {
      ready = typeof target.crypto?.getRandomValues === 'function';
    } catch {
      ready = false;
    }
    if (ready) return;
    Object.defineProperty(host, 'crypto', {
      value: { getRandomValues },
      configurable: true,
      writable: true,
    });
  } catch {
    try {
      (host as Record<string, unknown>).crypto = { getRandomValues };
    } catch {
      // ignore
    }
  }
}

if (typeof globalThis !== 'undefined') {
  installWebCrypto(globalThis);
}
if (typeof global !== 'undefined' && (global as unknown) !== (globalThis as unknown)) {
  installWebCrypto(global);
}
if (typeof window !== 'undefined' && (window as unknown) !== (globalThis as unknown)) {
  installWebCrypto(window);
}
