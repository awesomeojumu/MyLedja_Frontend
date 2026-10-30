import { readConfig } from '@/config';

describe('EXPO_PUBLIC_REDESIGN flag', () => {
  it('is off when unset', () => {
    expect(readConfig({ EXPO_PUBLIC_API_URL: 'http://localhost:4000' }).redesign).toBe(false);
  });

  it('turns on for 1/true/on/yes', () => {
    for (const v of ['1', 'true', 'TRUE', 'on', 'yes']) {
      expect(readConfig({ EXPO_PUBLIC_API_URL: 'http://localhost:4000', EXPO_PUBLIC_REDESIGN: v }).redesign).toBe(true);
    }
  });

  it('stays off for other values', () => {
    expect(readConfig({ EXPO_PUBLIC_API_URL: 'http://localhost:4000', EXPO_PUBLIC_REDESIGN: '0' }).redesign).toBe(false);
  });
});
