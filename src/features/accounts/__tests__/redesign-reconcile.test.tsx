import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { AddTransactionProvider } from '@/features/transactions/AddTransaction';
import { t } from '@/i18n';
import { ledgerBalance } from '@/ledger';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { ReconcileScreen } from '../ReconcileScreen';

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

jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank Current', type: 'bank', openingBalance: '41250000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const id = s.accounts[0]!.id;
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

describe('Page 10 redesign Reconcile', () => {
  it('renders Figma copy, bank balance field, and totals', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByText(t('redesign.reconcile.title'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.hint'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.balanceLabel'))).toBeTruthy();
    expect(screen.getByTestId('reconcile-statement')).toBeTruthy();
    expect(screen.getByTestId('reconcile-statement-date')).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.myledjaShows'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.bankShows'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.difference'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.tickHeading'))).toBeTruthy();
    expect(screen.getByTestId('reconcile-finish')).toBeTruthy();
    expect(screen.getByTestId('reconcile-progress')).toBeTruthy();
    expect(screen.getByTestId('reconcile-cleared-deposits')).toBeTruthy();
    expect(screen.getByTestId('reconcile-cleared-withdrawals')).toBeTruthy();
  });

  it('shows pending bank amount until entered, then difference', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByTestId('reconcile-says-pending')).toBeTruthy();
    expect(screen.getByTestId('reconcile-difference-pending')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reconcile-statement'), '410300');
    expect(await screen.findByTestId('reconcile-says')).toHaveTextContent('₦410,300.00');
    expect(screen.getByTestId('reconcile-cleared')).toHaveTextContent('₦412,500.00');
    expect(screen.getByTestId('reconcile-difference')).toBeTruthy();
    expect(screen.getByTestId('reconcile-difference-ruby')).toBeTruthy();
  });

  it('Finish at matching balance locks ticked rows', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.changeText(await screen.findByTestId('reconcile-statement'), '412500');
    await fireEvent.press(screen.getByTestId(`reconcile-tick-${opening.id}`));
    await fireEvent.press(screen.getByTestId('reconcile-finish'));
    await waitFor(async () => expect((await repo.load()).events.find((e) => e.id === opening.id)?.reconciledBy).toBeTruthy());
  });

  it('offers adjustment with memo when bank differs, posts without income or spending', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.press(await screen.findByTestId(`reconcile-tick-${opening.id}`));
    await fireEvent.changeText(screen.getByTestId('reconcile-statement'), '410300');
    expect(await screen.findByTestId('reconcile-adjust-memo')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reconcile-adjust-memo'), 'Bank stamp duty variance');
    await fireEvent.press(screen.getByTestId('reconcile-finish'));
    expect(await screen.findByText(t('reconcile.adjustConfirm'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redesign-dialog-confirm'));
    await waitFor(async () => {
      const snap = await repo.load();
      expect(ledgerBalance(id, snap.events)).toBe(41_030_000n);
      const adj = snap.events.find((e) => e.type === 'balance_adjustment');
      expect(adj?.notes).toBe('Bank stamp duty variance');
    });
  });

  it('Cancel asks leave without finishing', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByTestId('reconcile-cancel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reconcile-cancel'));
    expect(await screen.findByText(t('reconcile.leaveTitle'))).toBeTruthy();
  });

  it('Add missing opens Add with this account', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.changeText(await screen.findByTestId('reconcile-statement'), '412500');
    await fireEvent.press(screen.getByTestId('reconcile-add-missing'));
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ add: 'expense', account: id }));
  });

  it('switches between All, Payments, and Deposits tabs and updates subtotals', async () => {
    const { sync, repo, id } = await seeded();
    const snap = await repo.load();
    const cat = snap.categories[0]!;
    await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      date: '2026-10-05',
      payeeName: 'Groceries',
      parts: [{ categoryId: cat.id, amount: 500000n }],
    });
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });

    expect(await screen.findByTestId('reconcile-tab-all')).toBeTruthy();
    expect(screen.getByTestId('reconcile-tab-payments')).toBeTruthy();
    expect(screen.getByTestId('reconcile-tab-deposits')).toBeTruthy();

    // Click payments tab
    await fireEvent.press(screen.getByTestId('reconcile-tab-payments'));
    expect(screen.getByText(/Groceries/)).toBeTruthy();

    // Click deposits tab (opening balance is an inflow)
    await fireEvent.press(screen.getByTestId('reconcile-tab-deposits'));
    expect(screen.getByText(/Opening balance/)).toBeTruthy();
  });

  it('bulk selects with Clear all and Unclear all', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });

    expect(await screen.findByTestId('reconcile-clear-all')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reconcile-clear-all'));

    // Subtotal of cleared deposits should now reflect opening balance
    expect(screen.getByTestId('reconcile-cleared-deposits')).toHaveTextContent('₦412,500.00');

    // Unclear all
    await fireEvent.press(screen.getByTestId('reconcile-unclear-all'));
    expect(screen.getByTestId('reconcile-cleared-deposits')).toHaveTextContent('₦0.00');
  });

  it('detective spots exact discrepancy and transpositions', async () => {
    const { sync, repo, id } = await seeded();
    const snap = await repo.load();
    const cat = snap.categories[0]!;
    // Add a transaction for ₦900 (transposition-friendly divisible by 9)
    await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      date: '2026-10-05',
      payeeName: 'Service fee',
      parts: [{ categoryId: cat.id, amount: 90000n }],
    });
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });

    // Bank balance differs by ₦900 from myledja
    await fireEvent.changeText(await screen.findByTestId('reconcile-statement'), '410700');
    expect(await screen.findByTestId('reconcile-detective')).toBeTruthy();
    expect(screen.getByTestId('reconcile-detective-transposition')).toBeTruthy();

    // Check fee logging shortcut
    expect(screen.getByTestId('reconcile-fee-emtl')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reconcile-fee-emtl'));
    await waitFor(async () => {
      const updated = await repo.load();
      expect(updated.events.some((e) => e.notes === 'EMTL levy')).toBe(true);
    });
  });

  it('views past reconciliation history and supports undo reconciliation', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    // Perform an initial reconciliation
    await repo.finishReconcile({
      accountId: id,
      statementDate: '2026-10-10',
      statementBalance: 41250000n,
      eventIds: [opening.id],
      withAdjustment: false,
    });
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });

    // Open past reconciliations sheet
    await fireEvent.press(await screen.findByTestId('reconcile-history-btn'));
    expect(await screen.findByTestId('reconcile-history-sheet')).toBeTruthy();
    expect(screen.getByTestId('reconcile-undo-btn')).toBeTruthy();

    // Trigger undo
    await fireEvent.press(screen.getByTestId('reconcile-undo-btn'));
    expect(await screen.findByTestId('reconcile-undo-dialog')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redesign-dialog-confirm'));

    await waitFor(async () => {
      const updated = await repo.load();
      expect(updated.reconciles.length).toBe(0);
      const ev = updated.events.find((e) => e.id === opening.id);
      expect(ev?.reconciledBy).toBeFalsy();
    });
  });

  it('imports statement text and auto-matches unticked rows', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });

    // Open import statement sheet
    await fireEvent.press(await screen.findByTestId('reconcile-import-btn'));
    expect(await screen.findByTestId('reconcile-import-dialog')).toBeTruthy();

    // Paste text containing 412,500.00
    await fireEvent.changeText(screen.getByTestId('reconcile-import-input'), 'Statement line: Oct 1 CR 412500.00 Ref 99182');
    await fireEvent.press(screen.getByTestId('reconcile-import-confirm'));

    // Should have auto-matched and ticked opening balance
    await waitFor(() => {
      expect(screen.getByTestId('reconcile-cleared-deposits')).toHaveTextContent('₦412,500.00');
    });
  });
});
