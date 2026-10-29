import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { formatDay } from '@/design/components';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { InvestmentsScreen } from '../InvestmentsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' },
      { name: 'Brokerage', type: 'investment', openingBalance: '0', openingDate: '2026-10-01' },
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

async function withHolding(repo: WorkspaceRepository) {
  const s = await repo.load();
  const inv = s.accounts.find((a) => a.type === 'investment')!;
  const cash = s.accounts.find((a) => a.type === 'bank')!;
  const created = await repo.createHolding({ name: 'MTN', type: 'stock', accountId: inv.id, symbol: 'MTNN' });
  if (!created.ok) throw new Error('holding');
  const buy = await repo.buyHolding({
    holdingId: created.value.id,
    units: '500',
    pricePerUnit: 21000n,
    fees: 50000n,
    cashAccountId: cash.id,
    date: '2026-10-03',
  });
  if (!buy.ok) throw new Error(buy.error);
  return { holding: created.value, cash, inv };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Investments page (P17)', () => {
  it('P17-01: portfolio value, unrealised, dividends, value line', async () => {
    const { sync, repo } = await seeded();
    const { holding } = await withHolding(repo);
    await repo.savePrices([{ holdingId: holding.id, priceMinor: 23600n }], '2026-10-28');
    await renderWithProviders(wrap(<InvestmentsScreen />), { sync });
    expect(await screen.findByTestId('investments-summary')).toBeTruthy();
    expect(screen.getByTestId('portfolio-unrealised')).toBeTruthy();
    expect(screen.getByTestId('portfolio-dividends')).toBeTruthy();
    expect(screen.getByTestId('investments-value-line')).toBeTruthy();
    expect(screen.getByText(t('investments.totalValue'))).toBeTruthy();
  });

  it('P17-02: holdings list shows units, cost, value and gain', async () => {
    const { sync, repo } = await seeded();
    const { holding } = await withHolding(repo);
    await repo.savePrices([{ holdingId: holding.id, priceMinor: 23600n }], '2026-10-28');
    await renderWithProviders(wrap(<InvestmentsScreen />), { sync });
    const row = await screen.findByTestId(`holding-row-${holding.id}`);
    expect(row).toHaveTextContent(/MTN/);
    expect(row).toHaveTextContent(/500/);
  });

  it('P17-03: buy records cost including fees (case 15)', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(wrap(<InvestmentsScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('investments-add'));
    expect(await screen.findByTestId('holding-sheet')).toBeTruthy();
    expect(screen.getByTestId('holding-currency')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('holding-account'));
    expect(await screen.findByTestId('holding-account-add-new')).toHaveTextContent('+ Add account');
    // Pick Brokerage so the select closes before save.
    await fireEvent.press(screen.getByRole('radio', { name: 'Brokerage' }));
    await fireEvent.changeText(screen.getByTestId('holding-name'), 'MTN');
    await waitFor(() => expect(screen.getByTestId('holding-save')).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId('holding-save'));
    await waitFor(() => expect(screen.getByTestId('trade-sheet')).toBeTruthy());
    // Holding sheet must not stay closed-before-buy: trade opens after create.
    expect(screen.queryByTestId('holding-sheet')).toBeNull();
    await waitFor(async () => expect((await repo.load()).holdings).toHaveLength(1));
    await fireEvent.changeText(screen.getByTestId('trade-units'), '500');
    await fireEvent.changeText(screen.getByTestId('trade-price'), '210');
    await fireEvent.changeText(screen.getByTestId('trade-fees'), '500');
    await waitFor(() => expect(screen.getByTestId('trade-save')).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId('trade-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(after.lots).toHaveLength(1);
      expect(after.lots[0]!.costMinor).toBe('10550000');
    });
  });

  it('P17-04: Update prices lists holdings and saves filled rows', async () => {
    const { sync, repo } = await seeded();
    const { holding } = await withHolding(repo);
    await renderWithProviders(wrap(<InvestmentsScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('investments-prices'));
    expect(await screen.findByTestId('prices-sheet')).toBeTruthy();
    expect(screen.getByTestId(`price-row-${holding.id}`)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId(`price-row-${holding.id}`), '236');
    await fireEvent.press(screen.getByTestId('prices-save'));
    await waitFor(async () => {
      const prices = (await repo.load()).prices.filter((p) => p.holdingId === holding.id);
      expect(prices.some((p) => p.priceMinor === '23600')).toBe(true);
    });
  });

  it('P17-05: price rise shows unrealised gain, not income', async () => {
    const { sync, repo } = await seeded();
    const { holding } = await withHolding(repo);
    await repo.savePrices([{ holdingId: holding.id, priceMinor: 23600n }], '2026-10-28');
    await renderWithProviders(wrap(<InvestmentsScreen />), { sync });
    const unrealised = await screen.findByTestId('portfolio-unrealised');
    expect(unrealised).toHaveTextContent('+₦12,500.00', { exact: false });
    const snap = await repo.load();
    const incomeEvents = snap.events.filter((e) => e.type === 'income' && e.status === 'posted');
    expect(incomeEvents).toHaveLength(0);
  });

  it('P17-06: missing price shows "Price not updated since …" and value uses cost', async () => {
    const { sync, repo } = await seeded();
    const { holding } = await withHolding(repo);
    await renderWithProviders(wrap(<InvestmentsScreen />), { sync });
    const stale = await screen.findByTestId(`stale-price-${holding.id}`);
    expect(stale).toHaveTextContent(t('investments.priceNotUpdated', { date: formatDay('2026-10-03') }));
    // Value falls back to cost ₦105,500.00
    expect(screen.getAllByText(formatNaira(10550000n)).length).toBeGreaterThan(0);
  });

  it('usePopupParam: ?holding=new / ?prices=1 / ?trade=buy open sheets', async () => {
    const { sync, repo } = await seeded();
    await withHolding(repo);
    await act(async () => setParams({ holding: 'new' }));
    await renderWithProviders(wrap(<InvestmentsScreen />), { sync });
    expect(await screen.findByTestId('holding-sheet')).toBeTruthy();
    await act(async () => {
      resetParams();
      setParams({ prices: '1' });
    });
    expect(await screen.findByTestId('prices-sheet')).toBeTruthy();
    await act(async () => {
      resetParams();
      setParams({ trade: 'buy' });
    });
    expect(await screen.findByTestId('trade-sheet')).toBeTruthy();
  });
});
