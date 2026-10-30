import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { RedesignCashFlowScreen } from '../RedesignCashFlowScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

async function seeded({ months = ['09', '10'] }: { months?: string[] } = {}) {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: `2026-${months[0]}-01` }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const bank = s.accounts.find((a) => a.name === 'GTBank')!.id;
  const market = s.categories.find((c) => c.name === 'Market')!.id;
  const salary = s.categories.find((c) => c.kind === 'income')!.id;
  for (const m of months) {
    await repo.addTransaction({
      kind: 'income',
      accountId: bank,
      categoryId: salary,
      amount: 200_000_000n,
      date: `2026-${m}-05`,
    });
    await repo.addTransaction({
      kind: 'expense',
      accountId: bank,
      parts: [{ categoryId: market, amount: 50_000_000n }],
      date: `2026-${m}-10`,
      payeeName: 'Shop',
    });
  }
  return { sync, repo };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  router.push.mockClear();
  router.back.mockClear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Redesign Cash flow (Figma 5:2532)', () => {
  it('shows chips, left-over net, where from / went, View as table, no bottom nav', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignCashFlowScreen />), { sync });

    expect(await screen.findByTestId('redesign-cashflow-net')).toBeTruthy();
    expect(screen.getByTestId('redesign-cashflow-range-this_month')).toBeTruthy();
    expect(screen.getByTestId('redesign-cashflow-range-last_month')).toHaveTextContent(t('reports.redesign.chipLastMonth'));
    expect(screen.getByTestId('redesign-cashflow-range-last_3_months')).toHaveTextContent(t('reports.redesign.chip3Months'));
    expect(screen.getByTestId('redesign-cashflow-range-this_year')).toBeTruthy();
    expect(screen.getByText(t('cashFlow.redesign.leftOverIn', { month: t('date.monthLong.10') }))).toBeTruthy();
    expect(screen.getByTestId('redesign-cashflow-from')).toBeTruthy();
    expect(screen.getByTestId('redesign-cashflow-went')).toBeTruthy();
    expect(screen.getByTestId('redesign-cashflow-view-table')).toHaveTextContent(t('cashFlow.redesign.viewAsTable'));
    expect(screen.queryByTestId('redesign-bottom-nav')).toBeNull();
  });

  it('View as table toggles and drills a category', async () => {
    const { sync } = await seeded();
    setParams({ view: 'table' });
    await renderWithProviders(wrap(<RedesignCashFlowScreen />), { sync });

    expect(await screen.findByTestId('redesign-cashflow-table')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-cashflow-group-group:group.food'));
    });
    const cat = await screen.findByTestId(/redesign-cashflow-cat-/);
    await act(async () => {
      fireEvent.press(cat);
    });
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/\/transactions\?/));
  });

  it('range chip switches period label for last month', async () => {
    const { sync } = await seeded({ months: ['09', '10'] });
    setParams({ range: 'last_month' });
    await renderWithProviders(wrap(<RedesignCashFlowScreen />), { sync });

    await waitFor(() => {
      expect(screen.getByTestId('redesign-cashflow-net')).toBeTruthy();
    });
    expect(screen.getByText(t('cashFlow.redesign.leftOverIn', { month: t('date.monthLong.9') }))).toBeTruthy();
    expect(screen.getByTestId('redesign-cashflow-range-last_month').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('empty range shows empty state', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-01-01' }],
      categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    await renderWithProviders(wrap(<RedesignCashFlowScreen />), { sync });
    await waitFor(() => {
      expect(screen.getByTestId('redesign-cashflow-empty')).toBeTruthy();
    });
  });

  it('back navigates away', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignCashFlowScreen />), { sync });
    await waitFor(() => {
      expect(screen.getByTestId('redesign-cashflow')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-back'));
    });
    expect(router.back).toHaveBeenCalled();
  });
});
