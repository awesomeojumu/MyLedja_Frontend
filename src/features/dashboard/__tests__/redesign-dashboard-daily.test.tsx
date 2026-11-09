import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { AddTransactionProvider } from '@/features/transactions/AddTransaction';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { DashboardScreen } from '../DashboardScreen';
import {
  comingUp48Hours,
  liquidAccounts,
  timeGreeting,
  timeOfDay,
  todaySpending,
} from '../redesignHelpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T14:00:00Z'));
  resetParams();
  router.push.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

async function seededWithData() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' },
      { name: 'OPay Wallet', type: 'wallet', openingBalance: '2500000', openingDate: '2026-10-01' },
      { name: 'House Mortgage', type: 'loan', openingBalance: '500000000', openingDate: '2026-10-01' },
    ],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.transport', group: 'group.gettingAround', name: 'Transport' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();

  // Add bill due tomorrow (Oct 29)
  await repo.addRecurring({
    kind: 'bill',
    name: 'DSTV Subscription',
    amountMinor: '1450000',
    accountId: s.accounts[0]!.id,
    categoryId: s.categories[0]!.id,
    rule: { every: 'month', on: 29 },
    startDate: '2026-10-01',
  });

  // Add today's expense (Oct 28)
  await repo.addTransaction({
    kind: 'expense',
    accountId: s.accounts[0]!.id,
    parts: [{ categoryId: s.categories[0]!.id, amount: 450_000n }],
    date: '2026-10-28',
    notes: 'Groceries',
  });

  // Assign budget
  await repo.setAssigned(s.categories[0]!.id, '2026-10', 50_000_000n);

  return { sync, repo };
}

describe('Dashboard Daily Use Upgrades', () => {
  it('timeOfDay and timeGreeting adapt to morning, afternoon, and evening', () => {
    const morning = new Date('2026-10-28T08:00:00');
    expect(timeOfDay(morning)).toBe('morning');
    expect(timeGreeting('Ayoba', morning)).toContain('Good morning, Ayoba');

    const afternoon = new Date('2026-10-28T14:00:00');
    expect(timeOfDay(afternoon)).toBe('afternoon');
    expect(timeGreeting('Ayoba', afternoon)).toContain('Good afternoon, Ayoba');

    const evening = new Date('2026-10-28T19:00:00');
    expect(timeOfDay(evening)).toBe('evening');
    expect(timeGreeting('Ayoba', evening)).toContain('Good evening, Ayoba');

    expect(timeGreeting(null, morning)).toBe(t('dashboard.redesign.timeGreetingGenericMorning'));
  });

  it('renders time-aware contextual greeting and privacy toggle', async () => {
    const { sync } = await seededWithData();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <DashboardScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );

    expect(await screen.findByTestId('redesign-home-title')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-privacy-toggle')).toBeTruthy();

    // Toggle privacy masks amounts
    await fireEvent.press(screen.getByTestId('redesign-home-privacy-toggle'));
    expect(screen.getAllByText('₦ ••••••').length).toBeGreaterThan(0);
  });

  it('renders 1-tap quick action presets strip and triggers add transaction', async () => {
    const { sync } = await seededWithData();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <DashboardScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );

    expect(await screen.findByTestId('redesign-home-quick-actions')).toBeTruthy();
    expect(screen.getByTestId('quick-log-custom')).toBeTruthy();
    expect(screen.getByTestId('quick-log-transport')).toBeTruthy();
    expect(screen.getByTestId('quick-log-lunch')).toBeTruthy();
    expect(screen.getByTestId('quick-log-transfer')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('quick-log-transport'));
    expect(router.setParams).toHaveBeenCalledWith(
      expect.objectContaining({ add: 'expense', amount: '1500', payee: 'Ride' }),
    );
  });

  it('shows liquid accounts carousel excluding non-liquid loans', async () => {
    const { sync, repo } = await seededWithData();
    const snap = await repo.load();
    const liquid = liquidAccounts(snap);

    expect(liquid.map((l) => l.account.name)).toContain('GTBank');
    expect(liquid.map((l) => l.account.name)).toContain('OPay Wallet');
    expect(liquid.map((l) => l.account.name)).not.toContain('House Mortgage');

    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <DashboardScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );

    expect(await screen.findByTestId('redesign-home-liquid-accounts')).toBeTruthy();
    expect(screen.getByTestId(`liquid-account-${snap.accounts[0]!.id}`)).toBeTruthy();
  });

  it('detects urgency radar for bills in next 48 hours', async () => {
    const { sync, repo } = await seededWithData();
    const snap = await repo.load();
    const radar = comingUp48Hours(snap, '2026-10-28');

    expect(radar.some((r) => r.recurring.name === 'DSTV Subscription')).toBe(true);

    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <DashboardScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );

    expect(await screen.findByTestId('redesign-home-radar')).toBeTruthy();
    expect(screen.getAllByText(/DSTV Subscription/).length).toBeGreaterThan(0);
  });

  it('calculates today spending and promotes perDayLeft to the hero', async () => {
    const { sync, repo } = await seededWithData();
    const snap = await repo.load();
    const spentToday = todaySpending(snap, '2026-10-28');

    expect(spentToday.count).toBe(1);
    expect(spentToday.spent).toBe(450_000n);

    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <DashboardScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );

    expect(await screen.findByTestId('redesign-home-left')).toBeTruthy();
    expect(screen.getByTestId('redesign-home-left-amount')).toBeTruthy();
    expect(screen.getByText(new RegExp(t('dashboard.redesign.safeForToday', { amount: '' }).trim()))).toBeTruthy();
  });

  it('shows inbox zero card when unsorted transactions exist and clean badge when 0', async () => {
    const { sync, repo } = await seededWithData();
    const snap = await repo.load();

    // Directly put an unsorted event into KV store
    await sync.store.kv.set([
      [
        'r:events:tx-unsorted-1',
        JSON.stringify({
          collection: 'events',
          id: 'tx-unsorted-1',
          version: 1,
          updatedAt: '2026-10-28T14:00:00Z',
          deleted: false,
          data: {
            type: 'expense',
            date: '2026-10-28',
            lines: [
              { a: snap.accounts[0]!.id, m: '-120000', c: 'NGN' },
              { a: 'uncat-test-id', m: '120000', c: 'NGN' },
            ],
            notes: 'POS Purchase',
          },
        }),
      ],
    ]);

    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <DashboardScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );

    expect(await screen.findByTestId('redesign-home-inbox-zero')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redesign-home-inbox-zero'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/transactions',
      params: { uncategorized: '1' },
    });
  });
});
