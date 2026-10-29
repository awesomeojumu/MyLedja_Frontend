import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { AppNotification } from '@/data/workspace/model';

import { unreadCount } from './helpers';

/** D27-13: browser tab shows "(N) MyLedja" when there are unread notifications. */
export function useUnreadDocumentTitle(items: AppNotification[] | undefined) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const base = 'MyLedja';
    const n = items ? unreadCount(items) : 0;
    document.title = n > 0 ? `(${n}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [items]);
}
