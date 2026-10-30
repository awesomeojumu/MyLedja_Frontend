import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { NotificationsScreen } from '../NotificationsScreen';

import { router } from 'expo-router';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));
jest.mock('../localPush', () => ({
  syncLocalBillReminder: jest.fn(async () => undefined),
}));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  jest.mocked(router.push).mockClear();
  jest.mocked(router.back).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Page 27 redesign Notifications (EXPO_PUBLIC_REDESIGN on)', () => {
  it('shows empty state from Figma 13:6410 (bell + copy, no filter chips)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-notifications')).toBeTruthy();
    expect(screen.getByTestId('notifications-redesign-empty')).toBeTruthy();
    expect(screen.getByText(t('notifications.redesign.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('notifications.redesign.emptyBody'))).toBeTruthy();
    expect(screen.queryByTestId('notifications-filter-all')).toBeNull();
    expect(screen.queryByTestId('notifications-mark-all')).toBeNull();
  });

  it('lists grouped rows with Mark all as read and Notification settings (Figma 2:1140)', async () => {
    const { sync } = await seeded();
    await sync.store.replace({
      collection: 'notifications',
      id: 'n-today',
      version: 1,
      data: {
        createdAt: '2026-10-28T09:00:00.000Z',
        title: 'Rent is due on Sunday',
        body: '₦75,000.00 from GTBank Current',
        category: 'bills',
        read: false,
        action: 'mark_paid',
      },
    });
    await sync.store.replace({
      collection: 'notifications',
      id: 'n-earlier',
      version: 1,
      data: {
        createdAt: '2026-10-01T10:00:00.000Z',
        title: '12 transactions to sort',
        body: 'Give them a category',
        category: 'budget',
        read: true,
        action: 'see_budget',
      },
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('notifications-redesign-list')).toBeTruthy();
    expect(screen.getByText('Rent is due on Sunday')).toBeTruthy();
    expect(screen.getByText('₦75,000.00 from GTBank Current')).toBeTruthy();
    expect(screen.getByText('12 transactions to sort')).toBeTruthy();
    expect(screen.getByText(t('notifications.group.today'))).toBeTruthy();
    expect(screen.getByText(t('notifications.group.earlier'))).toBeTruthy();
    expect(screen.getByTestId('notifications-mark-all')).toBeTruthy();
    expect(screen.getByText(t('notifications.redesign.markAllRead'))).toBeTruthy();
    expect(screen.getByTestId('notifications-settings')).toBeTruthy();
    expect(screen.queryByTestId('notifications-filter-bills')).toBeNull();
  });

  it('Notification settings opens Settings › Notifications', async () => {
    const { sync } = await seeded();
    await sync.store.replace({
      collection: 'notifications',
      id: 'n1',
      version: 1,
      data: {
        createdAt: '2026-10-28T09:00:00.000Z',
        title: 'Rent is due on Sunday',
        category: 'bills',
        read: false,
        action: 'mark_paid',
      },
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByTestId('notifications-settings'));
    expect(router.push).toHaveBeenCalledWith('/settings/notifications');
  });

  it('row tap on see_budget navigates to budget', async () => {
    const { sync } = await seeded();
    await sync.store.replace({
      collection: 'notifications',
      id: 'n-budget',
      version: 1,
      data: {
        createdAt: '2026-10-28T08:12:00.000Z',
        title: 'Food is over plan',
        body: '₦62,400.00 spent of ₦60,000.00',
        category: 'budget',
        read: false,
        action: 'see_budget',
      },
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByTestId('notification-n-budget'));
    expect(router.push).toHaveBeenCalledWith('/budget');
  });
});
