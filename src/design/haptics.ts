/* The haptic map from the brand book, behind one function. Respects the person's setting via the theme. */
import * as Haptics from 'expo-haptics';

export type HapticMoment = 'select' | 'start' | 'success' | 'warning' | 'error';

export function haptic(moment: HapticMoment, enabled: boolean = true): void {
  if (!enabled) return;
  const run = (): Promise<void> => {
    switch (moment) {
      case 'select': return Haptics.selectionAsync();
      case 'start': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'success': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  run().catch(() => {});
}
