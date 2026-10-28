import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { AccountsScreen } from '@/features/accounts/AccountsScreen';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { AddTransactionProvider } from '../AddTransaction';
import { today } from '../helpers';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-10-01' },
      { name: 'OPay', type: 'wallet', openingBalance: '0', openingDate: '2026-10-01' },
      { name: 'Loan', type: 'loan', openingBalance: '84000000', openingDate: '2026-10-01' },
    ],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.rent', group: 'group.home', name: 'Rent' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

async function show(screenEl: React.ReactElement, sync: ReturnType<typeof memorySync>) {
  await renderWithProviders(
    <WorkspaceProvider workspaceId="ws-personal">
      <AddTransactionProvider>{screenEl}</AddTransactionProvider>
    </WorkspaceProvider>,
    { sync },
  );
  await screen.findByTestId('tx-add').catch(() => screen.findByTestId('add-account'));
}

async function typeAmount(testID: string, value: string) {
  await fireEvent.changeText(screen.getByTestId(testID), value);
}

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Add transaction', () => {
  it('A-01: amount, category, save; today and the last-used account are filled in', async () => {
    const { sync, repo } = await seeded();
    await show(<TransactionsScreen />, sync);
    await fireEvent.press(screen.getByTestId('tx-add'));
    expect(router.setParams).toHaveBeenCalledWith({ add: 'expense', account: undefined, date: undefined });
    await screen.findByTestId('add-transaction');
    expect(screen.getByTestId('save-transaction')).toBeDisabled();
    await typeAmount('add-amount', '18450');
    const market = (await repo.load()).categories.find((c) => c.name === 'Market')!;
    await fireEvent.press(screen.getByTestId(`category-${market.id}`));
    await fireEvent.press(screen.getByTestId('save-transaction'));
    await waitFor(() => expect(screen.queryByTestId('add-transaction')).toBeNull());
    expect(await screen.findByText(t('add.saved'))).toBeTruthy();
    const s = await repo.load();
    const saved = s.events.find((e) => e.type === 'expense')!;
    expect(saved.date).toBe(today());
    expect(saved.lines.find((l) => l.amountMinor < 0n)?.ledgerAccountId).toBe(s.accounts[0]!.id);
    expect(await screen.findByLabelText(`${t('cat.market')}, ${t('cat.market')}, −₦18,450.00`)).toBeTruthy();
  });

  it('A-02: an amount that cannot be read keeps Save disabled and says why', async () => {
    const { sync } = await seeded();
    await show(<TransactionsScreen />, sync);
    await act(async () => router.setParams({ add: 'expense' }));
    await typeAmount('add-amount', '1,2,3');
    expect(screen.getByText(t('money.unreadable'))).toBeTruthy();
    expect(screen.getByTestId('save-transaction')).toBeDisabled();
  });

  it('A-05: a transfer says it is not income or spending', async () => {
    const { sync } = await seeded();
    await show(<TransactionsScreen />, sync);
    await act(async () => router.setParams({ add: 'transfer' }));
    expect(await screen.findByText(t('add.transferNote'))).toBeTruthy();
  });

  it('A-06: a split saves only at ₦0.00 left to assign', async () => {
    const { sync, repo } = await seeded();
    await show(<TransactionsScreen />, sync);
    await act(async () => router.setParams({ add: 'expense' }));
    await typeAmount('add-amount', '9000');
    await fireEvent.press(screen.getByTestId('add-split'));
    const cats = (await repo.load()).categories;
    for (const [i, name, amount] of [
      [0, 'Market', '3000'],
      [1, 'Rent', '5000'],
    ] as const) {
      await fireEvent.press(screen.getByTestId(`split-category-${i}`));
      await fireEvent.press(screen.getAllByRole('radio', { name })[0]!);
      await typeAmount(`split-amount-${i}`, amount);
    }
    expect(screen.getByTestId('split-left')).toHaveTextContent(t('add.leftToAssign', { amount: '₦1,000.00' }));
    expect(screen.getByTestId('save-transaction')).toBeDisabled();
    await typeAmount('split-amount-1', '6000');
    expect(screen.getByTestId('split-left')).toHaveTextContent(t('add.leftToAssign', { amount: '₦0.00' }));
    await fireEvent.press(screen.getByTestId('save-transaction'));
    await waitFor(async () => expect((await repo.load()).events.some((e) => e.type === 'expense')).toBe(true));
    const e = (await repo.load()).events.find((x) => x.type === 'expense')!;
    expect(e.lines.filter((l) => l.amountMinor > 0n).map((l) => [cats.find((c) => c.id === l.ledgerAccountId)?.name, l.amountMinor])).toEqual([
      ['Market', 300_000n],
      ['Rent', 600_000n],
    ]);
  });

  it('A-07: Save and add another clears the form and keeps the account and date', async () => {
    const { sync, repo } = await seeded();
    await show(<TransactionsScreen />, sync);
    await act(async () => router.setParams({ add: 'income' }));
    await typeAmount('add-amount', '640000');
    const salary = (await repo.load()).categories.find((c) => c.name === 'Salary')!;
    await fireEvent.press(screen.getByTestId(`category-${salary.id}`));
    await fireEvent.press(screen.getByTestId('save-another'));
    await waitFor(() => expect(screen.getByTestId('add-amount').props.value).toBe(''));
    expect(screen.getByTestId('add-transaction')).toBeTruthy();
    expect(screen.getByTestId('save-transaction')).toBeDisabled();
  });

  it('G-08: closing after typing asks to discard', async () => {
    const { sync } = await seeded();
    await show(<TransactionsScreen />, sync);
    await act(async () => router.setParams({ add: 'expense' }));
    await typeAmount('add-amount', '100');
    await fireEvent.press(screen.getAllByLabelText(t('common.close'), { includeHiddenElements: true })[0]!);
    expect(await screen.findByText(t('common.discardTitle'))).toBeTruthy();
  });
});

describe('Transactions', () => {
  it('groups by day, searches, and deletes with Undo', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const gt = s.accounts[0]!.id;
    const market = s.categories.find((c) => c.name === 'Market')!.id;
    await repo.addTransaction({ kind: 'expense', accountId: gt, parts: [{ categoryId: market, amount: 1_845_000n }], date: '2026-10-28', payeeName: 'Shoprite Lekki' });
    await repo.addTransaction({ kind: 'expense', accountId: gt, parts: [{ categoryId: market, amount: 850_000n }], date: '2026-10-27', payeeName: 'Bolt' });
    await show(<TransactionsScreen />, sync);
    expect(await screen.findByTestId('day-2026-10-28')).toBeTruthy();
    expect(screen.getByTestId('day-2026-10-27')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('tx-search'), 'shoprite');
    expect(screen.queryByTestId('day-2026-10-27')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('tx-search'), '8,500');
    expect(screen.queryByTestId('day-2026-10-28')).toBeNull();
    expect(screen.getByTestId('day-2026-10-27')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('tx-search'), '');

    const day = screen.getByTestId('day-2026-10-28');
    await fireEvent.press(within(day).getByRole('button', { name: t('tx.actions') }));
    await fireEvent.press(await screen.findByRole('menuitem', { name: t('tx.delete') }));
    await waitFor(() => expect(screen.queryByTestId('day-2026-10-28')).toBeNull());
    await fireEvent.press(await screen.findByRole('button', { name: t('common.undo') }));
    expect(await screen.findByTestId('day-2026-10-28')).toBeTruthy();
  });

  it('shows an empty state with one button', async () => {
    const sync = memorySync();
    await show(<TransactionsScreen />, sync);
    expect(await screen.findByText(t('tx.emptyTitle'))).toBeTruthy();
  });
});

describe('Accounts', () => {
  it('groups accounts with totals, shows what is owed and net worth', async () => {
    const { sync } = await seeded();
    await show(<AccountsScreen />, sync);
    expect(await screen.findByTestId('group-cashBank')).toBeTruthy();
    expect(screen.getByTestId('group-loans')).toBeTruthy();
    expect(screen.getByTestId('net-worth')).toHaveTextContent('−₦27,700.00');
    expect(within(screen.getByTestId('group-loans')).getByText(t('accounts.youOwe'), { exact: false })).toBeTruthy();
  });

  it('adds an account with only the last 4 digits and an opening balance that is not income', async () => {
    const { sync, repo } = await seeded();
    await show(<AccountsScreen />, sync);
    await fireEvent.press(await screen.findByTestId('add-account'));
    await fireEvent.press(screen.getByTestId('type-wallet'));
    await fireEvent.changeText(screen.getByTestId('account-name'), 'Kuda');
    await fireEvent.changeText(screen.getByTestId('account-last4'), '12345678');
    expect(screen.getByTestId('account-last4').props.value).toBe('1234');
    await typeAmount('account-opening', '24200');
    await fireEvent.press(screen.getByTestId('save-account'));
    await waitFor(async () => expect((await repo.load()).accounts.some((a) => a.name === 'Kuda')).toBe(true));
    const kuda = (await repo.load()).accounts.find((a) => a.name === 'Kuda')!;
    expect(kuda.last4).toBe('1234');
    expect(await screen.findByTestId(`account-${kuda.id}`)).toBeTruthy();
  });
});
