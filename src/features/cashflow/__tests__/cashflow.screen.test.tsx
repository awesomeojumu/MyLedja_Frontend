import { fireEvent, screen, within } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { CashFlowScreen } from '../CashFlowScreen';
import { cashFlowPage } from '../helpers';
import { previousPeriod } from '../RangeBar';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 375;
let mockHeight = 900;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 1, fontScale: 1 }),
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
    await repo.addTransaction({
      kind: 'expense',
      accountId: bank,
      parts: [{ categoryId: market, amount: 50_000_000n }],
      date: `2026-${m}-10`,
      payeeName: 'Shop',
    });
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
  mockHeight = 900;
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

  it('TB14-2: previous period is the same length just before', () => {
    expect(previousPeriod({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' });
  });

  it('D22-20: selecting a sink highlights the whole path source → middle → category', async () => {
    mockWidth = 1024;
    mockHeight = 768;
    const { sync } = await seeded({ months: ['10'] });
    await page(sync, <CashFlowScreen />);
    const frame = await screen.findByTestId('cashflow-sankey-frame');
    await fireEvent(frame, 'layout', { nativeEvent: { layout: { width: 800, height: 480 } } });
    const sink = await screen.findByTestId('band-group:group.food');
    await fireEvent.press(sink);
    expect(screen.getByTestId('band-group:group.food').props.opacity).toBe(0.9);
    expect(screen.getByTestId('bar-middle').props.opacity).toBe(0.9);
    expect(screen.getByTestId('band-left_over').props.opacity).toBe(0.2);
    const litRibbons = screen.getAllByTestId(/^band-/).filter((n) => n.props.opacity === 0.9);
    expect(litRibbons.length).toBeGreaterThanOrEqual(2);
  });

  it('include transfers is off by default and toggling is in the address', async () => {
    const { sync } = await seeded({ months: ['10'] });
    await page(sync, <CashFlowScreen />);
    expect(await screen.findByTestId('cashflow-sankey-legend')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('range-filters'));
    const transfers = await screen.findByTestId('cashflow-transfers');
    expect(transfers.props.accessibilityState?.checked).toBe(false);
    await fireEvent.press(transfers);
    expect(router.setParams).toHaveBeenCalled();
    const last = [...router.setParams.mock.calls].reverse().find((c) => (c[0] as { transfers?: string }).transfers)?.[0] as {
      transfers?: string;
    };
    expect(last?.transfers).toBe('1');
  });
});
