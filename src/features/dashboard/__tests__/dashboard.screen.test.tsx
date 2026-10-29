import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { DashboardScreen } from '../DashboardScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

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
  const s = await repo.load();
  await repo.addTransaction({
    kind: 'income',
    accountId: s.accounts[0]!.id,
    categoryId: s.categories.find((c) => c.kind === 'income')!.id,
    amount: 100_000_000n,
    date: '2026-10-05',
  });
  await repo.setAssigned(s.categories.find((c) => c.name === 'Market')!.id, '2026-10', 50_000_000n);
  return { sync, repo };
}

describe('Dashboard', () => {
  it('P05-03: four stat tiles render for the month', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('dashboard-tile-income')).toBeTruthy();
    expect(screen.getByTestId('dashboard-tile-spent')).toBeTruthy();
    expect(screen.getByTestId('dashboard-tile-net-cash')).toBeTruthy();
    expect(screen.getByTestId('dashboard-tile-budget-left')).toBeTruthy();
  });

  it('P05-10: Coming up card is shown', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    await repo.addRecurring({
      kind: 'bill',
      name: 'Rent',
      amountMinor: '5000000',
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === 'expense')!.id,
      rule: { every: 'month', on: 5 },
      startDate: '2026-10-01',
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('dashboard-coming-up')).toBeTruthy();
    expect(screen.getAllByText('Rent').length).toBeGreaterThan(0);
  });

  it('Phase 2: Goals and Debts cards link sections', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('dashboard-goals')).toBeTruthy();
    expect(screen.getByTestId('dashboard-debts')).toBeTruthy();
    expect(screen.getByText(t('dashboard.goalsCard'))).toBeTruthy();
    expect(screen.getByText(t('dashboard.debtsCard'))).toBeTruthy();
  });

  it('Phase 5: the Health card waits for two months; the Investments card shows the portfolio once there is a holding', async () => {
    const { sync, repo } = await seeded();
    await repo.addAccount({ name: 'Stanbic Shares', type: 'investment', openingBalance: 0n, openingDate: '2026-10-01' });
    const s = await repo.load();
    const broker = s.accounts.find((a) => a.name === 'Stanbic Shares')!.id;
    const added = await repo.addHolding({ name: 'MTN Nigeria', type: 'stock', accountId: broker, date: '2026-10-10' });
    if (!added.ok) throw new Error(added.error);
    await repo.buyHolding({ holdingId: added.value.id, accountId: s.accounts[0]!.id, units: '100', price: 20000n, fees: 0n, date: '2026-10-10' });
    await repo.setPrices('2026-10-20', [{ holdingId: added.value.id, price: 22000n }]);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('dashboard-health-not-ready')).toHaveTextContent(t('health.notReadyTitle'));
    expect(screen.getByTestId('dashboard-investments-value')).toHaveTextContent('₦22,000.00');
    expect(screen.getByTestId('dashboard-investments-gain')).toHaveTextContent(t('dashboard.investmentsGain', { amount: '+₦2,000.00', pct: '+10.0%' }));
  });

  it('P05-08: Customize opens popup #6', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    fireEvent.press(await screen.findByTestId('dashboard-customize'));
    expect(await screen.findByTestId('dashboard-customize-sheet')).toBeTruthy();
    expect(screen.getByText(t('dashboard.customizeTitle'))).toBeTruthy();
  });
});
