import { Platform } from 'react-native';

import type { AppNotification } from '@/data/workspace/model';

/** Placeholder for expo-notifications scheduling (F2.5). In-app actions are canonical until native module ships. */
export async function syncLocalBillReminder(_notification: AppNotification): Promise<void> {
  if (Platform.OS === 'web') return;
}
