import { readConfig } from '..';

describe('readConfig', () => {
  it('reads the three public variables', () => {
    const c = readConfig({
      EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_API_URL: 'https://api.example.test/',
      EXPO_PUBLIC_MONO_PUBLIC_KEY: 'test_pk',
    });
    expect(c).toEqual({
      appEnv: 'staging',
      apiUrl: 'https://api.example.test',
      monoPublicKey: 'test_pk',
      redesign: false,
      problems: [],
    });
  });
  it('reads optional EXPO_PUBLIC_REDESIGN without treating it as a problem', () => {
    const off = readConfig({ EXPO_PUBLIC_API_URL: 'https://api.example.test/' });
    expect(off.redesign).toBe(false);
    expect(off.problems).toEqual([]);
    const on = readConfig({ EXPO_PUBLIC_API_URL: 'https://api.example.test/', EXPO_PUBLIC_REDESIGN: '1' });
    expect(on.redesign).toBe(true);
    expect(on.problems).toEqual([]);
  });
  it('reports a missing API URL by name', () => {
    const c = readConfig({});
    expect(c.apiUrl).toBeNull();
    expect(c.problems).toEqual(['EXPO_PUBLIC_API_URL']);
    expect(c.appEnv).toBe('development');
  });
  it('never echoes a malformed value', () => {
    const c = readConfig({ EXPO_PUBLIC_APP_ENV: 'secret-ish', EXPO_PUBLIC_API_URL: 'not a url' });
    expect(c.problems).toEqual(['EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_API_URL']);
    expect(JSON.stringify(c.problems)).not.toContain('secret-ish');
  });
  it('turns Mono off when its key is unset', () => {
    expect(readConfig({ EXPO_PUBLIC_API_URL: 'http://localhost:4000' }).monoPublicKey).toBeNull();
  });
});
