import { getRandomValues } from 'expo-crypto';

type RandomSource = {
  getRandomValues: (bytes: Uint8Array) => Uint8Array;
};

/** Hermes has no global crypto. uuid calls crypto.getRandomValues while sync starts. */
export function installWebCrypto(host: object = globalThis): void {
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
}

installWebCrypto();
