import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { AddTransactionProvider } from '@/features/transactions/AddTransaction';
import { t } from '@/i18n';
import { ledgerBalance, monthIncome, monthSpent, periodTotals } from '@/ledger';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { ReconcileScreen } from '../ReconcileScreen';
import { AccountScreen } from '../AccountScreen';

jest.mock('expo-router', () => {
  const actual = require('../../../../test/helpers/router');
  return {
    ...actual,
    useNavigation: () => ({
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
  };
});

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '79010000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
  return { sync, repo, id };
}

const wrap = (el: React.ReactElement) => (
  <WorkspaceProvider workspaceId="ws-personal">
    <AddTransactionProvider>{el}</AddTransactionProvider>
  </WorkspaceProvider>
);

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Reconcile', () => {
  it('never shows a fake ₦0.00 while the statement amount is unknown', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await waitFor(() => expect(screen.getByTestId('reconcile-says-pending')).toBeTruthy());
    expect(screen.getByTestId('reconcile-difference-pending')).toBeTruthy();
    expect(screen.queryByTestId('reconcile-says')).toBeNull();
    expect(screen.queryByTestId('reconcile-difference')).toBeNull();
  });

  it('P10-01: statement date and balance show Cleared, Statement and Difference', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByTestId('reconcile-date')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`reconcile-tick-${opening.id}`));
    await fireEvent.changeText(screen.getByTestId('reconcile-statement'), '812300');
    expect(await screen.findByTestId('reconcile-cleared')).toHaveTextContent('₦790,100.00');
    expect(screen.getByTestId('reconcile-says')).toHaveTextContent('₦812,300.00');
    expect(screen.getByTestId('reconcile-difference')).toHaveTextContent('+₦22,200.00');
    expect(screen.getByTestId('reconcile-difference-ruby')).toBeTruthy();
  });

  it('P10-02: ticking updates the Difference; at ₦0 it shows Balanced', async () => {
    const { sync, repo, id } = await seeded();
    const expense = await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Market'), amount: 22_200_000n }],
      date: '2026-10-15',
      payeeName: 'Shoprite',
    });
    if (!expense.ok) throw new Error(expense.error);
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.changeText(await screen.findByTestId('reconcile-statement'), '790100');
    await fireEvent.press(screen.getByTestId(`reconcile-tick-${opening.id}`));
    expect(await screen.findByTestId('reconcile-balanced')).toBeTruthy();
    expect(screen.getByText(`✓ ${t('reconcile.balanced')}`)).toBeTruthy();
  });

  it('P10-03: finishing with a difference posts an adjustment that is not income or spending (case 20)', async () => {
    const { sync, repo, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    await fireEvent.press(await screen.findByTestId(`reconcile-tick-${opening.id}`));
    await fireEvent.changeText(screen.getByTestId('reconcile-statement'), '812300');
    await fireEvent.press(screen.getByTestId('reconcile-finish'));
    expect(await screen.findByText(t('reconcile.adjustConfirm'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reconcile-adjust-confirm'));
    await waitFor(async () => expect(ledgerBalance(id('GTBank'), (await repo.load()).events)).toBe(81_230_000n));
    const after = await repo.load();
    const totals = periodTotals(after.events);
    expect(monthIncome(after.chart, totals, '2026-10')).toBe(0n);
    expect(monthSpent(after.chart, totals, '2026-10')).toBe(0n);
    expect(after.reconciles).toHaveLength(1);
    expect(after.reconciles[0]!.adjustment).toBe('2220000');
  });

  it('P10-04: Add missing transaction opens Add with this account and the statement date', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.changeText(await screen.findByTestId('reconcile-statement'), '790100');
    await fireEvent.press(screen.getByTestId('reconcile-add-missing'));
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ add: 'expense', account: id('GTBank') }));
  });

  it('P10-05a: finishing locks ticked rows', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.press(await screen.findByTestId(`reconcile-tick-${opening.id}`));
    await fireEvent.changeText(screen.getByTestId('reconcile-statement'), '790100');
    await fireEvent.press(screen.getByTestId('reconcile-finish'));
    await waitFor(async () => expect((await repo.load()).events.find((e) => e.id === opening.id)?.reconciledBy).toBeTruthy());
  });

  it('P10-05b: changing a locked row asks Confirm then unlock', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    const finished = await repo.finishReconcile({
      accountId: id('GTBank'),
      statementDate: '2026-10-31',
      statementBalance: 79_010_000n,
      eventIds: [opening.id],
      withAdjustment: false,
    });
    expect(finished.ok).toBe(true);
    setParams({ id: id('GTBank'), tx: opening.id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    expect(await screen.findByTestId('panel-locked')).toBeTruthy();
    expect(screen.queryByTestId('panel-edit')).toBeNull();
    await fireEvent.press(screen.getByTestId('panel-unlock'));
    expect(await screen.findByTestId('panel-unlock-confirm')).toBeTruthy();
    expect(screen.getByText(t('panel.unlockTitle'))).toBeTruthy();
    expect(screen.getByText(t('panel.unlockBodyDated', { date: '31 Oct 2026' }))).toBeTruthy();
    expect(screen.getByTestId('panel-unlock-confirm-cancel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('panel-unlock-confirm-confirm'));
    await waitFor(async () => expect((await repo.load()).events.find((e) => e.id === opening.id)?.reconciledBy).toBeUndefined());
  });

  it('P10-06: Cancel asks leave without finishing', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByTestId('reconcile-cancel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reconcile-cancel'));
    expect(await screen.findByText(t('reconcile.leaveTitle'))).toBeTruthy();
  });
});
