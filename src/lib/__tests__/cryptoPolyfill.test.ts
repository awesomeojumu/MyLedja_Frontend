import { installWebCrypto } from '@/lib/cryptoPolyfill';

describe('installWebCrypto', () => {
  it('installs getRandomValues when crypto is missing', () => {
    const host: { crypto?: { getRandomValues: (bytes: Uint8Array) => Uint8Array } } = {};
    installWebCrypto(host);
    const bytes = new Uint8Array(16);
    expect(host.crypto?.getRandomValues(bytes)).toBe(bytes);
  });

  it('leaves an existing crypto in place', () => {
    const existing = { getRandomValues: (bytes: Uint8Array) => bytes };
    const host = { crypto: existing };
    installWebCrypto(host);
    expect(host.crypto).toBe(existing);
  });

  it('installs when reading crypto throws', () => {
    const host: { crypto?: { getRandomValues: (bytes: Uint8Array) => Uint8Array } } = {};
    Object.defineProperty(host, 'crypto', {
      configurable: true,
      get() {
        throw new ReferenceError("Property 'crypto' doesn't exist");
      },
    });
    installWebCrypto(host);
    const bytes = new Uint8Array(8);
    expect(host.crypto?.getRandomValues(bytes)).toBe(bytes);
  });
});
