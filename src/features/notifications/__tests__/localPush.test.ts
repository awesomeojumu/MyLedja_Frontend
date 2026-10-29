import { Platform } from 'react-native';

jest.mock('expo-notifications', () => {
  const state: {
    listener:
      | ((r: {
          actionIdentifier: string;
          notification: { request: { content: { data: Record<string, unknown> } } };
        }) => void)
      | null;
  } = { listener: null };
  return {
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    scheduleNotificationAsync: jest.fn(async () => 'id'),
    setNotificationChannelAsync: jest.fn(async () => undefined),
    setNotificationCategoryAsync: jest.fn(async () => undefined),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    setBadgeCountAsync: jest.fn(async () => undefined),
    setNotificationHandler: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn(
      (
        cb: (r: {
          actionIdentifier: string;
          notification: { request: { content: { data: Record<string, unknown> } } };
        }) => void,
      ) => {
        state.listener = cb;
        return { remove: () => undefined };
      },
    ),
    __state: state,
  };
});

import * as Notifications from 'expo-notifications';
import {
  ACTION_MARK_PAID,
  ACTION_REMIND_TOMORROW,
  BILLS_CHANNEL_ID,
  BILL_CATEGORY_ID,
  __resetLocalPushForTests,
  attachLocalPushHandlers,
  buildLockScreenContent,
  ensureLocalPushReady,
  reminderFireDay,
  shouldHideAmountOnLock,
  syncLocalBillReminder,
} from '../localPush';

const mod = Notifications as typeof Notifications & {
  __state: { listener: ((r: unknown) => void) | null };
  scheduleNotificationAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  setNotificationCategoryAsync: jest.Mock;
};

beforeEach(() => {
  __resetLocalPushForTests();
  mod.__state.listener = null;
  mod.scheduleNotificationAsync.mockClear();
  mod.setNotificationChannelAsync.mockClear();
  mod.setNotificationCategoryAsync.mockClear();
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
});

describe('localPush (P12-07)', () => {
  it('hides amounts by default on the lock screen', () => {
    const n = {
      id: 'bill:1:2026-11-01',
      createdAt: '2026-10-01T00:00:00Z',
      title: 'Rent due',
      category: 'bills' as const,
      read: false,
      amountMinor: '25000000',
      hideAmount: true,
    };
    expect(shouldHideAmountOnLock(n)).toBe(true);
    expect(buildLockScreenContent(n).body).not.toMatch(/250/);
    expect(buildLockScreenContent({ ...n, hideAmount: false }, false).body).toMatch(/250/);
  });

  it('registers Mark paid and Remind me tomorrow actions and schedules on Bills channel', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    await ensureLocalPushReady();
    expect(mod.setNotificationChannelAsync).toHaveBeenCalledWith(
      BILLS_CHANNEL_ID,
      expect.objectContaining({ name: 'Bills' }),
    );
    expect(mod.setNotificationCategoryAsync).toHaveBeenCalledWith(
      BILL_CATEGORY_ID,
      expect.arrayContaining([
        expect.objectContaining({ identifier: ACTION_MARK_PAID, buttonTitle: 'Mark paid' }),
        expect.objectContaining({ identifier: ACTION_REMIND_TOMORROW, buttonTitle: 'Remind me tomorrow' }),
      ]),
    );
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 10);
    const dueDate = due.toISOString().slice(0, 10);
    await syncLocalBillReminder({
      id: 'bill:rent:' + dueDate,
      createdAt: new Date().toISOString(),
      title: 'Rent',
      category: 'bills',
      read: false,
      dueDate,
      amountMinor: '100',
      hideAmount: true,
      recurringId: 'rent',
    });
    expect(mod.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('routes Mark paid and Remind me tomorrow through attached handlers', async () => {
    const onMarkPaid = jest.fn();
    const onRemindTomorrow = jest.fn();
    const onOpen = jest.fn();
    await ensureLocalPushReady();
    attachLocalPushHandlers({ onMarkPaid, onRemindTomorrow, onOpen });
    const data = {
      id: 'n1',
      title: 'Rent',
      recurringId: 'r1',
      dueDate: '2026-11-02',
      hideAmount: true,
    };
    mod.__state.listener?.({
      actionIdentifier: ACTION_MARK_PAID,
      notification: { request: { content: { data } } },
    });
    expect(onMarkPaid).toHaveBeenCalled();
    mod.__state.listener?.({
      actionIdentifier: ACTION_REMIND_TOMORROW,
      notification: { request: { content: { data } } },
    });
    expect(onRemindTomorrow).toHaveBeenCalled();
  });

  it('computes reminder fire day from daysBefore', () => {
    expect(reminderFireDay('2026-11-10', 1)).toBe('2026-11-09');
    expect(reminderFireDay('2026-11-10', 0)).toBe('2026-11-10');
  });
});
