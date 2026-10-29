import { Platform, Vibration } from 'react-native';

/** Select haptic when a band is tapped (DESIGN.md page 22). No-op on web. */
export function selectHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(10);
  } catch {
    /* unsupported */
  }
}
