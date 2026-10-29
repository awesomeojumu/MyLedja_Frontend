import { fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { DebtsScreen } from '../DebtsScreen';
import { debtInitials } from '../helpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/design/size', () => ({
  useSizeClass: () => 'phone',
  sizeClassFor: () => 'phone',
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

describe('Debts page (F2.4)', () => {
  it('P15-01: shows summary tiles', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByText(t('debts.title'))).toBeTruthy();
    expect(screen.getByTestId('debts-summary')).toBeTruthy();
    expect(screen.getByTestId('debts-lent')).toBeTruthy();
  });

  it('P15-03: lending is not spending copy', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-lent'));
    expect(screen.getByText(t('debts.lendCaption'))).toBeTruthy();
  });

  it('P15-05: phone lend sheet offers pick from contacts', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-lent'));
    expect(screen.getByTestId('debt-pick-contact')).toBeTruthy();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  it('row shows initials avatar and percent-back label', async () => {
    expect(debtInitials('Tunde Okafor')).toBe('TO');
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    await repo.openPersonDebt({
      name: 'Tunde Okafor',
      direction: 'owedToMe',
      accountId: snap.accounts[0]!.id,
      amount: 10_000_000n,
      date: '2026-10-01',
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    const after = await repo.load();
    const debt = after.debts[0]!;
    expect(screen.getByTestId(`debt-avatar-${debt.id}`)).toBeTruthy();
    expect(screen.getByText('TO')).toBeTruthy();
    expect(screen.getByTestId(`debt-progress-${debt.id}`)).toBeTruthy();
  });
});
