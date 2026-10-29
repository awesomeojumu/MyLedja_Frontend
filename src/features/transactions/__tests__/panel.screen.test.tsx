import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { monthSpent, periodTotals } from '@/ledger';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { AddTransactionProvider } from '../AddTransaction';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

async function withGroceries() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '0', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const r = await repo.addTransaction({
    kind: 'expense',
    accountId: s.accounts[0]!.id,
    parts: [{ categoryId: s.categories[0]!.id, amount: 1_845_000n }],
    date: '2026-10-28',
    payeeName: 'Shoprite',
  });
  if (!r.ok) throw new Error(r.error);
  await renderWithProviders(
    <WorkspaceProvider workspaceId="ws-personal">
      <AddTransactionProvider>
        <TransactionsScreen />
      </AddTransactionProvider>
    </WorkspaceProvider>,
    { sync },
  );
  await screen.findByTestId(`open-${r.value.id}`);
  return { repo, id: r.value.id };
}

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Transaction panel', () => {
  it('opens from its row and has its own address', async () => {
    const { id } = await withGroceries();
    await fireEvent.press(screen.getByTestId(`open-${id}`));
    expect(router.setParams).toHaveBeenCalledWith({ tx: id, txn: id });
    expect(await screen.findByTestId('tx-panel')).toBeTruthy();
    expect(screen.getByTestId('panel-amount')).toHaveTextContent('−₦18,450.00');
  });

  it('P11-05 / case 21: changing the amount saves a correction, marked Edited, with both versions in history', async () => {
    const { repo, id } = await withGroceries();
    await act(async () => router.setParams({ tx: id }));
    await fireEvent.press(await screen.findByTestId('panel-edit'));
    await fireEvent.changeText(screen.getByTestId('panel-edit-amount'), '18540');
    await fireEvent.press(screen.getByTestId('panel-save'));
    await waitFor(async () => expect((await repo.load()).events.filter((e) => e.type === 'reversal')).toHaveLength(1));
    const s = await repo.load();
    expect(monthSpent(s.chart, periodTotals(s.events), '2026-10')).toBe(1_854_000n);
    const edited = s.events.find((e) => e.correctionOf === id)!;
    // Saving a correction should keep the panel open on the new event.
    expect(router.setParams).toHaveBeenCalledWith({ tx: edited.id, txn: edited.id });
    await act(async () => router.setParams({ tx: edited.id, txn: edited.id }));
    const history = await screen.findByTestId('panel-history');
    expect(within(history).getByText('−₦18,450.00')).toBeTruthy();
    expect(within(history).getByText('−₦18,540.00')).toBeTruthy();
    expect(screen.getAllByText(t('panel.edited')).length).toBeGreaterThan(0);
  });

  it('P11-07 / case 14: a refund can never be more than the purchase', async () => {
    const { repo, id } = await withGroceries();
    await act(async () => router.setParams({ tx: id }));
    await fireEvent.press(await screen.findByTestId('panel-add-refund'));
    await fireEvent.changeText(screen.getByTestId('refund-amount'), '20000');
    expect(screen.getByTestId('refund-error')).toHaveTextContent(t('ledger.error.refund_too_large', { amount: '₦18,450.00' }));
    expect(screen.getByTestId('refund-save')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('refund-amount'), '5000');
    await fireEvent.press(screen.getByTestId('refund-save'));
    await waitFor(async () => expect((await repo.load()).events.some((e) => e.type === 'refund')).toBe(true));
    const s = await repo.load();
    expect(monthSpent(s.chart, periodTotals(s.events), '2026-10')).toBe(1_345_000n);
  });

  it('notes change in place without a correction', async () => {
    const { repo, id } = await withGroceries();
    await act(async () => router.setParams({ tx: id }));
    const notes = await screen.findByTestId('panel-notes');
    await fireEvent.changeText(notes, 'Monthly shop');
    await fireEvent(notes, 'blur');
    await waitFor(async () => expect((await repo.load()).events.find((e) => e.id === id)?.notes).toBe('Monthly shop'));
    expect((await repo.load()).events.filter((e) => e.type === 'reversal')).toHaveLength(0);
  });

  it('a deleted transaction cannot be corrected again', async () => {
    const { repo, id } = await withGroceries();
    await repo.deleteTransaction(id, '2026-10-29');
    const r = await repo.correctTransaction(id, { kind: 'expense', accountId: 'x', parts: [], date: '2026-10-29' });
    expect(r).toEqual({ ok: false, error: 'already_reversed' });
  });
});
