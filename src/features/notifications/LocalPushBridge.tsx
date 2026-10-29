import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useWorkspace } from '@/data/workspace/WorkspaceProvider';

import {
  attachLocalPushHandlers,
  cancelLocalBillReminder,
  ensureLocalPushReady,
  syncAppBadge,
  syncLocalBillReminder,
} from './localPush';

/** Wires expo-notifications actions to the workspace repo (P12-07 / F2.5). */
export function LocalPushBridge() {
  const { repo, snapshot } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    void ensureLocalPushReady();
    attachLocalPushHandlers({
      onMarkPaid: async (n) => {
        if (!n.recurringId || !n.dueDate || !snapshot) return;
        const bill = snapshot.recurring.find((r) => r.id === n.recurringId);
        if (!bill) return;
        const categoryId = bill.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')?.id;
        if (!categoryId) return;
        await repo.markBillPaid(n.recurringId, n.dueDate, {
          accountId: bill.accountId,
          categoryId,
          amount: BigInt(bill.amountMinor),
          date: n.dueDate,
          payeeId: bill.payeeId,
        });
        await cancelLocalBillReminder(n.id);
      },
      onRemindTomorrow: async (n) => {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        await repo.snoozeNotification(n.id, tomorrow.toISOString().slice(0, 10));
        await cancelLocalBillReminder(n.id);
      },
      onOpen: (n) => {
        if (n.recurringId && n.dueDate) {
          router.push(`/plan?occurrence=${n.recurringId}:${n.dueDate}`);
        } else {
          router.push('/notifications');
        }
      },
    });
  }, [repo, router, snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const prefsHide = snapshot.settings.notificationPrefs?.hideAmountsOnLockScreen !== false;
    const unread = snapshot.notifications.filter((n) => !n.read).length;
    void syncAppBadge(unread);
    for (const n of snapshot.notifications) {
      if (n.category !== 'bills' || !n.dueDate) continue;
      const bill = snapshot.recurring.find((r) => r.id === n.recurringId);
      if (n.read || n.snoozedUntil) {
        void cancelLocalBillReminder(n.id);
        continue;
      }
      void syncLocalBillReminder(
        { ...n, hideAmount: n.hideAmount !== false && bill?.hideAmountOnLock !== false },
        { daysBefore: bill?.reminderDays ?? 1, prefsHideAmounts: prefsHide },
      );
    }
  }, [snapshot]);

  return null;
}
