import * as LocalAuthentication from 'expo-local-authentication';
import { checkBiometrics, promptBiometricAuth } from '../biometrics';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

describe('biometrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects available face biometrics on native', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([2]);

    const status = await checkBiometrics();
    expect(status.available).toBe(true);
    expect(status.enrolled).toBe(true);
    expect(status.biometricType).toBe('face');
  });

  it('detects fingerprint biometrics', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);

    const status = await checkBiometrics();
    expect(status.available).toBe(true);
    expect(status.biometricType).toBe('fingerprint');
  });

  it('prompts biometric authentication successfully', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    const success = await promptBiometricAuth('Test reason');
    expect(success).toBe(true);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: 'Test reason' }),
    );
  });
});
