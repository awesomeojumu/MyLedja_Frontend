import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricStatus = {
  available: boolean;
  enrolled: boolean;
  biometricType: 'face' | 'fingerprint' | 'iris' | 'generic' | 'none';
};

/**
 * Checks if the hardware supports biometrics and if the user has enrolled biometrics.
 */
export async function checkBiometrics(): Promise<BiometricStatus> {
  if (Platform.OS === 'web') {
    return { available: false, enrolled: false, biometricType: 'none' };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return { available: false, enrolled: isEnrolled, biometricType: 'none' };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let biometricType: BiometricStatus['biometricType'] = 'generic';

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'face';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'iris';
    }

    return { available: true, enrolled: true, biometricType };
  } catch {
    return { available: false, enrolled: false, biometricType: 'none' };
  }
}

/**
 * Requests biometric authentication from the user.
 */
export async function promptBiometricAuth(reason = 'Unlock MyLedja'): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
