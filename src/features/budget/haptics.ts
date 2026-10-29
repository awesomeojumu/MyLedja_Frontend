import { Platform, Vibration } from 'react-native';

/** Warning haptic when a plan edit goes over (PU07-3). No-op on web. */
export function warningHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(40);
  } catch {
    /* unsupported */
  }
}

/** Success haptic when a goal is reached (DESIGN page 14). No-op on web. */
export function successHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate([0, 30, 40, 30]);
  } catch {
    /* unsupported */
  }
}
