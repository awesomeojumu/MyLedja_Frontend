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

/** Success haptic on Welcome "You're set up" (DESIGN Page 4). No-op on web. */
export function successHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate([0, 30, 40, 30]);
  } catch {
    /* unsupported */
  }
}

/** Light select haptic when tapping a chart bar (DESIGN Page 7). No-op on web. */
export function selectHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(10);
  } catch {
    /* unsupported */
  }
}
