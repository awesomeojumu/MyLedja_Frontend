import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { DashboardScreen } from '../DashboardScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
  router.push.mockClear();
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

  it('D20: net worth card opens the Net worth report', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    fireEvent.press(await screen.findByTestId('dashboard-net-worth'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/reports', params: { kind: 'netWorth' } });
  });

  it('D20: income vs spending opens the matching report', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    fireEvent.press(await screen.findByTestId('dashboard-income-vs-spending'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/reports', params: { kind: 'incomeVsSpending' } });
  });

  it('PU-26: coming-up income stream opens Plan Mark received', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const stream = await repo.addIncomeStream({
      name: 'Salary',
      kind: 'regular',
      expectedMinor: '64000000',
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === 'income')!.id,
      rule: { every: 'month', on: 27 },
      countInBudget: true,
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    fireEvent.press(await screen.findByTestId(`dashboard-coming-up-row-stream:${stream.id}:2026-10-27`));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/plan',
      params: { occurrence: `stream:${stream.id}:2026-10-27` },
    });
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
