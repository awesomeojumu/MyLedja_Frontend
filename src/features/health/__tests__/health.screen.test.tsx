import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Share } from 'react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { CashFlowScreen } from '@/features/cashflow/CashFlowScreen';
import { cashFlowPage } from '@/features/cashflow/helpers';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { healthPage } from '../helpers';
import { HealthScreen } from '../HealthScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 375;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

/** Three full months of salary and market spending before October 2026. */
async function seeded({ months = ['07', '08', '09'], borrow = 0n } = {}) {
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
    await repo.addTransaction({ kind: 'income', accountId: bank, categoryId: salary, amount: 200_000_000n, date: `2026-${m}-05` });
    await repo.addTransaction({ kind: 'expense', accountId: bank, parts: [{ categoryId: market, amount: 50_000_000n }], date: `2026-${m}-10`, payeeName: 'Shop' });
  }
  if (borrow) {
    const r = await repo.openPersonDebt({ name: 'Tunde', direction: 'iOwe', accountId: bank, amount: borrow, date: '2026-09-20' });
    if (!r.ok) throw new Error(r.error);
  }
  return { sync, repo, bank };
}

const page = (sync: ReturnType<typeof memorySync>, node: React.ReactElement) =>
  renderWithProviders(<WorkspaceProvider workspaceId="ws-personal">{node}</WorkspaceProvider>, { sync });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
  router.push.mockClear();
  mockWidth = 375;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Cash flow (F5.3)', () => {
  it('P22-01, P22-02: income flows to spending; borrowed money is its own source and left over is what remains', async () => {
    const { repo } = await seeded({ borrow: 30_000_000n });
    const data = cashFlowPage(await repo.load(), { from: '2026-09-01', to: '2026-09-30', includeTransfers: false });
    const kinds = data.bands.map((b) => [b.side, b.kind, b.amount]);
    expect(kinds).toContainEqual(['in', 'income', 200_000_000n]);
    expect(kinds).toContainEqual(['in', 'borrowed', 30_000_000n]);
    expect(kinds).toContainEqual(['out', 'spending', 50_000_000n]);
    expect(kinds).toContainEqual(['out', 'left_over', 180_000_000n]);
    expect(data.tiles).toEqual({ in: 230_000_000n, out: 50_000_000n, savedBasisPoints: 9_000n });
  });

  it('P22-04, P22-05, P22-03: on a phone the simple view shows bars; the table shows change; a bar shows its share', async () => {
    const { sync } = await seeded({ months: ['09', '10'] });
    await page(sync, <CashFlowScreen />);
    expect(await screen.findByTestId('cashflow-sankey-legend')).toBeTruthy();
    expect(screen.getByTestId('cashflow-in')).toHaveTextContent('₦2,000,000.00', { exact: false });
    expect(screen.getByTestId('cashflow-saved')).toHaveTextContent('75.0%', { exact: false });
    expect(screen.getByTestId('cashflow-change-group:group.food')).toHaveTextContent('0.0%');
    await fireEvent.press(screen.getByTestId('cashflow-simple'));
    const bars = await screen.findByTestId('cashflow-simple-bars');
    await fireEvent.press(within(bars).getByLabelText(`${t('group.food')}, ₦500,000.00`));
    expect(screen.getByTestId('cashflow-selected-amount')).toHaveTextContent('₦500,000.00, 25.0% of income');
    await fireEvent.press(screen.getByTestId('cashflow-see'));
    expect(router.push).toHaveBeenCalledWith('/transactions?from=2026-10-01&to=2026-10-31');
  });
});

describe('Health (F5.4)', () => {
  it('P23-03: with less than two full months, no made-up score', async () => {
    const { sync } = await seeded({ months: ['10'] });
    await page(sync, <HealthScreen />);
    expect(await screen.findByTestId('health-not-ready')).toHaveTextContent(t('health.notReadyTitle'), { exact: false });
    expect(screen.queryByTestId('health-score')).toBeNull();
  });

  it('P23-01, P23-02, P23-04, P23-05: score, band, tiles with explainers, stale data and advice', async () => {
    const { sync } = await seeded();
    await page(sync, <HealthScreen />);
    const score = await screen.findByTestId('health-score');
    expect(Number(score.props.children)).toBeGreaterThan(0);
    expect(screen.getByTestId('health-band')).toBeTruthy();
    expect(screen.getByTestId('health-value-saving')).toHaveTextContent(t('health.value.saving', { pct: '75%' }));
    expect(screen.getByTestId('health-stale')).toHaveTextContent(t('health.basedOn', { date: '10 Sep 2026' }));
    await fireEvent.press(screen.getByTestId('health-tile-runway'));
    expect(screen.getByTestId('health-explain')).toBeTruthy();
    expect(screen.getByTestId('health-used-essential')).toHaveTextContent('₦500,000.00', { exact: false });
  });

  it('P23-07: borrowed money never raises the score', async () => {
    const a = await seeded();
    const b = await seeded({ borrow: 500_000_000n });
    const without = healthPage(await a.repo.load(), '2026-10', '2026-10-28');
    const withLoan = healthPage(await b.repo.load(), '2026-10', '2026-10-28');
    expect(withLoan.score!).toBeLessThanOrEqual(without.score!);
    expect(withLoan.pillars.find((p) => p.key === 'runway')!.value).toBe(without.pillars.find((p) => p.key === 'runway')!.value);
  });

  it('P23-06: the stress test updates as the slider moves', async () => {
    const { sync } = await seeded();
    await page(sync, <HealthScreen />);
    await screen.findByTestId('health-stress');
    await fireEvent.changeText(screen.getByTestId('health-stress-cost'), '1000000');
    const runway = screen.getByTestId('health-stress-runway');
    expect(runway).toHaveTextContent(t('health.stressRunway', { before: '11.0', after: '9.0' }));
    await fireEvent.press(screen.getByTestId('health-stress-100'));
    expect(screen.getByTestId('health-stress-score').props.children).not.toEqual(t('health.stressScore', { before: '1', after: '1' }));
  });

  it('P23-08: Share hides amounts by default', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const { sync } = await seeded();
    await page(sync, <HealthScreen />);
    await fireEvent.press(await screen.findByTestId('health-share'));
    await fireEvent.press(screen.getByTestId('health-share-send'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = share.mock.calls[0]![0].message!;
    expect(message).toContain(t('health.pillar.saving'));
    expect(message).not.toContain('₦');
  });
});
