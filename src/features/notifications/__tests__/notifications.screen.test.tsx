import { screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { NotificationsScreen } from '../NotificationsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

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

describe('Notifications page (F2.5)', () => {
  it('P27-01: shows grouped inbox header', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <NotificationsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByText(t('notifications.title'))).toBeTruthy();
    expect(screen.getByTestId('notifications-mark-all')).toBeTruthy();
  });
});
