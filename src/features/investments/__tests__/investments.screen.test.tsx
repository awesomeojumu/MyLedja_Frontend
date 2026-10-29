import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { monthSpent, periodTotals } from '@/ledger';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { HoldingScreen } from '../HoldingScreen';
import { InvestmentsScreen } from '../InvestmentsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 375;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

async function seeded({ buy = true, price = true } = {}) {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  await repo.addAccount({ name: 'Stanbic Shares', type: 'investment', openingBalance: 0n, openingDate: '2026-10-01' });
  const s = await repo.load();
  const bank = s.accounts.find((a) => a.name === 'GTBank')!.id;
  const broker = s.accounts.find((a) => a.name === 'Stanbic Shares')!.id;
  const added = await repo.addHolding({ name: 'MTN Nigeria', symbol: 'MTNN', type: 'stock', accountId: broker, date: '2026-10-10' });
  const mtn = added.ok ? added.value.id : '';
  if (buy) await repo.buyHolding({ holdingId: mtn, accountId: bank, units: '500', price: 21000n, fees: 50000n, date: '2026-10-10' });
  if (price) await repo.setPrices('2026-10-20', [{ holdingId: mtn, price: 23600n }]);
  return { sync, repo, bank, broker, mtn };
}

const page = (sync: ReturnType<typeof memorySync>, node: React.ReactElement) =>
  renderWithProviders(<WorkspaceProvider workspaceId="ws-personal">{node}</WorkspaceProvider>, { sync });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
  mockWidth = 375;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Investments page (F5.1)', () => {
  it('P17-01, P17-02: portfolio value, gain, and every holding with units, value and gain', async () => {
    mockWidth = 1200;
    const { sync, mtn } = await seeded();
    await page(sync, <InvestmentsScreen />);
    expect(await screen.findByTestId('portfolio-value')).toHaveTextContent('₦118,000.00');
    expect(screen.getByTestId('portfolio-unrealised')).toHaveTextContent('₦12,500.00 +11.8%');
    const row = screen.getByTestId(`holding-row-${mtn}`);
    expect(within(row).getByText('MTN Nigeria')).toBeTruthy();
    expect(within(row).getByText('500')).toBeTruthy();
    expect(within(row).getByText('₦211.00')).toBeTruthy();
    expect(within(row).getByText('₦236.00')).toBeTruthy();
    expect(screen.getByTestId('portfolio-line')).toBeTruthy();
  });

  it('P17-06: without a price, the value uses the cost and says so', async () => {
    const { sync, mtn } = await seeded({ price: false });
    await page(sync, <InvestmentsScreen />);
    expect(await screen.findByTestId(`stale-${mtn}`)).toHaveTextContent(t('investments.priceStale', { date: '10 Oct 2026' }));
    expect(screen.getByTestId('portfolio-value')).toHaveTextContent('₦105,500.00');
  });

  it('P17-04: Update prices saves today’s price for each holding', async () => {
    const { sync, repo, mtn } = await seeded();
    await page(sync, <InvestmentsScreen />);
    await fireEvent.press(await screen.findByTestId('investments-update-prices'));
    await fireEvent.changeText(screen.getByTestId(`price-${mtn}`), '250');
    await fireEvent.press(screen.getByTestId('prices-save'));
    await waitFor(async () => {
      expect((await repo.load()).prices.find((p) => p.date === '2026-10-28')?.priceMinor).toBe('25000');
    });
  });

  it('shows an empty state with one way to start', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [],
      categories: [],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    await page(sync, <InvestmentsScreen />);
    expect(await screen.findByTestId('investments-empty')).toBeTruthy();
    await fireEvent.press(screen.getByText(t('investments.addHolding'), { exact: true }));
    expect(await screen.findByTestId('holding-no-account')).toBeTruthy();
  });
});

describe('Holding page (F5.1)', () => {
  it('P18-01: value, gain, units and price', async () => {
    const { sync, mtn } = await seeded();
    setParams({ id: mtn });
    await page(sync, <HoldingScreen />);
    expect(await screen.findByTestId('holding-value')).toHaveTextContent('₦118,000.00');
    expect(screen.getByTestId('holding-units')).toHaveTextContent(t('investments.unitsAt', { units: '500', price: '₦236.00' }));
  });

  it('P17-03, P18-03: buying is not spending; selling shows the gain before saving, oldest lots first', async () => {
    const { sync, repo, mtn } = await seeded();
    setParams({ id: mtn });
    await page(sync, <HoldingScreen />);
    await fireEvent.press(await screen.findByTestId('holding-buy'));
    expect(screen.getByText(t('investments.buyCaption'))).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('trade-mode')).getByRole('radio', { name: t('investments.sell') }));
    await fireEvent.changeText(screen.getByTestId('trade-units'), '200');
    await fireEvent.changeText(screen.getByTestId('trade-price'), '240');
    expect(await screen.findByTestId('trade-gain')).toHaveTextContent('+₦5,800.00');
    await fireEvent.press(screen.getByTestId('trade-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.events.filter((e) => e.type === 'investment_sell')).toHaveLength(1);
      expect(monthSpent(s.chart, periodTotals(s.events), '2026-10')).toBe(0n);
    });
  });

  it('P18-04: a reinvested dividend', async () => {
    const { sync, repo, mtn } = await seeded();
    setParams({ id: mtn });
    await page(sync, <HoldingScreen />);
    await fireEvent.press(await screen.findByTestId('holding-dividend'));
    await fireEvent.changeText(screen.getByTestId('dividend-amount'), '5000');
    await fireEvent.press(screen.getByTestId('dividend-reinvested'));
    await fireEvent.changeText(screen.getByTestId('dividend-units'), '20');
    await fireEvent.press(screen.getByTestId('dividend-save'));
    await waitFor(async () => {
      const e = (await repo.load()).events.find((x) => x.investment?.kind === 'reinvest');
      expect(e?.investment).toEqual({ kind: 'reinvest', units: '20' });
    });
  });

  it('P18-02: lots show what each purchase cost and its gain', async () => {
    const { sync, mtn, repo } = await seeded();
    setParams({ id: mtn });
    await page(sync, <HoldingScreen />);
    const lotId = (await repo.load()).events.find((e) => e.type === 'investment_buy')!.id;
    expect(await screen.findByTestId(`lot-gain-${lotId}`)).toHaveTextContent('+₦12,500.00');
  });
});
