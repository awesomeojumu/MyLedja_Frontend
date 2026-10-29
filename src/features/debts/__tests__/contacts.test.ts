import { Platform } from 'react-native';

import { contactsAvailable, pickContact } from '../contacts';

const mockRequestPermissionsAsync = jest.fn();
const mockPresentContactPickerAsync = jest.fn();

jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  presentContactPickerAsync: (...args: unknown[]) => mockPresentContactPickerAsync(...args),
}));

describe('contacts (P15-05)', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    mockRequestPermissionsAsync.mockReset();
    mockPresentContactPickerAsync.mockReset();
  });

  it('is available on ios and android, not web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    expect(contactsAvailable()).toBe(true);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    expect(contactsAvailable()).toBe(true);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    expect(contactsAvailable()).toBe(false);
  });

  it('requests permission then presentContactPickerAsync on phone', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockPresentContactPickerAsync.mockResolvedValue({ firstName: 'Tunde', lastName: 'Okafor' });
    await expect(pickContact()).resolves.toEqual({ name: 'Tunde Okafor' });
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    expect(mockPresentContactPickerAsync).toHaveBeenCalled();
  });

  it('returns null when permission denied', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(pickContact()).resolves.toBeNull();
    expect(mockPresentContactPickerAsync).not.toHaveBeenCalled();
  });
});
