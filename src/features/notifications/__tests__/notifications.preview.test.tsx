import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { AppNotification } from '@/data/workspace/model';
import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { NotificationsBell } from '../NotificationsBell';
import { NotificationsScreen } from '../NotificationsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 1200;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
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

const billNote = (id: string, overrides: Partial<AppNotification> = {}): AppNotification => ({
  id,
  createdAt: '2026-10-28T10:00:00.000Z',
  title: 'Rent due',
  category: 'bills',
  read: false,
  action: 'mark_paid',
  amountMinor: '25000000',
  ...overrides,
});

describe('PU-05 / TB-12 notifications', () => {
  beforeEach(() => {
    mockWidth = 1200;
  });

  it('PU05: preview shows empty copy, mark all, and See all', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsBell items={[]} />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('notifications-bell'));
    expect(await screen.findByTestId('notifications-preview')).toBeTruthy();
    expect(screen.getByText(t('notifications.emptyPreview'))).toBeTruthy();
    expect(screen.getByTestId('notifications-see-all')).toBeTruthy();
  });

  it('PU05-1: preview lists action for a bill notification', async () => {
    const { sync } = await seeded();
    const items = [billNote('n1')];
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsBell items={items} />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('notifications-bell'));
    expect(await screen.findByTestId('notifications-preview-mark-all')).toBeTruthy();
    expect(screen.getByTestId('preview-action-n1')).toBeTruthy();
  });

  it('TB12-1: mark all read on Bills leaves other kinds unread', async () => {
    const { sync, repo } = await seeded();
    await sync.store.replace({
      collection: 'notifications',
      id: 'bill-1',
      version: 1,
      data: { createdAt: '2026-10-28T10:00:00.000Z', title: 'Rent', category: 'bills', read: false, action: 'mark_paid' },
    });
    await sync.store.replace({
      collection: 'notifications',
      id: 'sec-1',
      version: 1,
      data: { createdAt: '2026-10-28T11:00:00.000Z', title: 'New sign-in', category: 'security', read: false },
    });
    await repo.markAllNotificationsRead('bills');
    const snap = await repo.load();
    expect(snap.notifications.find((n) => n.id === 'bill-1')?.read).toBe(true);
    expect(snap.notifications.find((n) => n.id === 'sec-1')?.read).toBe(false);
  });

  it('TB12: empty state uses per-chip copy', async () => {
    const { sync } = await seeded();
    const { setParams } = require('../../../../test/helpers/router') as typeof import('../../../../test/helpers/router');
    setParams({ tab: 'bills' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await waitFor(() => expect(screen.getByText(t('notifications.empty.bills'))).toBeTruthy());
  });
});
