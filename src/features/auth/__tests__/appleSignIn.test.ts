import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { isAppleSignInAvailable, runAppleSignIn } from '../appleSignIn';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

describe('appleSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks availability correctly on iOS', async () => {
    Platform.OS = 'ios';
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    const available = await isAppleSignInAvailable();
    expect(available).toBe(true);
  });

  it('returns false on non-iOS', async () => {
    Platform.OS = 'android';
    const available = await isAppleSignInAvailable();
    expect(available).toBe(false);
  });

  it('handles user cancellation gracefully', async () => {
    Platform.OS = 'ios';
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    const mockApi = { signInWithApple: jest.fn() } as any;

    const result = await runAppleSignIn(mockApi);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('cancelled');
    }
  });

  it('successfully signs in with Apple', async () => {
    Platform.OS = 'ios';
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'test-token',
      email: 'appleuser@example.com',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    });
    const mockSession = { user: { id: '1', email: 'appleuser@example.com' }, token: 'xyz' };
    const mockApi = { signInWithApple: jest.fn().mockResolvedValue(mockSession) } as any;

    const result = await runAppleSignIn(mockApi);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session).toEqual(mockSession);
    }
  });
});
