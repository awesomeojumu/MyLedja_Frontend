import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { DashboardScreen } from '../DashboardScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

/** Three full months before October 2026 so the Health score can be ready. */
async function seeded(months: string[]) {
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
  const bank = s.accounts[0]!.id;
  const market = s.categories.find((c) => c.name === 'Market')!.id;
  const salary = s.categories.find((c) => c.kind === 'income')!.id;
  for (const m of months) {
    await repo.addTransaction({ kind: 'income', accountId: bank, categoryId: salary, amount: 200_000_000n, date: `2026-${m}-05` });
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

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
  router.push.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Dashboard Health card (F5.5)', () => {
  it('shows not-ready copy when there is too little history', async () => {
    const { sync } = await seeded(['10']);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('dashboard-health')).toBeTruthy();
    expect(screen.getByTestId('dashboard-health-not-ready')).toHaveTextContent(t('health.notReadyTitle'));
    expect(screen.queryByTestId('dashboard-health-score')).toBeNull();
  });

  it('shows the score and opens /health', async () => {
    const { sync } = await seeded(['07', '08', '09']);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DashboardScreen />
      </WorkspaceProvider>,
      { sync },
    );
    const score = await screen.findByTestId('dashboard-health-score');
    expect(Number(score.props.children)).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('dashboard-health'));
    expect(router.push).toHaveBeenCalledWith('/health');
  });
});
