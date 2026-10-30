import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { RedesignHealthScreen } from '../RedesignHealthScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

async function seeded({ months = ['07', '08', '09'] }: { months?: string[] } = {}) {
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
  jest.clearAllTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('Redesign Health (Figma 5:2231)', () => {
  it('shows score ring, factors, one next step, settings, no bottom nav', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignHealthScreen />), { sync });

    expect(await screen.findByTestId('redesign-health-score-card')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-ring')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-score')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-band')).toBeTruthy();
    expect(screen.getByText(t('health.redesign.whatMakesUp'))).toBeTruthy();
    expect(screen.getByTestId('redesign-health-factors')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-factor-saving')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-factor-bills')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-factor-runway')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-factor-debt_load')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-factor-budget')).toBeTruthy();
    expect(screen.getByTestId('redesign-health-settings')).toBeTruthy();
    expect(screen.queryByTestId('redesign-bottom-nav')).toBeNull();
  });

  it('opens factor explainer and settings sheet', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignHealthScreen />), { sync });
    await screen.findByTestId('redesign-health-factor-saving');
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-health-factor-saving'));
    });
    expect(await screen.findByTestId('redesign-health-explain')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-health-settings'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('redesign-health-settings-sheet')).toBeTruthy();
    });
  });

  it('advice CTA navigates to linked page when a next step exists', async () => {
    // Heavy spending leaves room to improve so advice is non-empty.
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '10000000', openingDate: '2026-07-01' }],
      categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    const s = await repo.load();
    const bank = s.accounts.find((a) => a.name === 'GTBank')!.id;
    const market = s.categories.find((c) => c.name === 'Market')!.id;
    const salary = s.categories.find((c) => c.kind === 'income')!.id;
    for (const m of ['07', '08', '09']) {
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
        parts: [{ categoryId: market, amount: 190_000_000n }],
        date: `2026-${m}-10`,
        payeeName: 'Shop',
      });
    }
    await renderWithProviders(wrap(<RedesignHealthScreen />), { sync });
    expect(await screen.findByTestId('redesign-health-next')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId(/redesign-health-advice-/));
    });
    expect(router.push).toHaveBeenCalled();
  });

  it('not ready when fewer than two months', async () => {
    const { sync } = await seeded({ months: ['10'] });
    await renderWithProviders(wrap(<RedesignHealthScreen />), { sync });
    expect(await screen.findByTestId('redesign-health-not-ready')).toBeTruthy();
    expect(screen.queryByTestId('redesign-health-score')).toBeNull();
  });

  it('back navigates away', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignHealthScreen />), { sync });
    await waitFor(() => {
      expect(screen.getByTestId('redesign-health')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('redesign-back'));
    });
    expect(router.back).toHaveBeenCalled();
  });
});
