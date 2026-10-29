import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { ImportSheet } from '@/features/import/ImportSheet';
import { t } from '@/i18n';
import { ledgerBalance } from '@/ledger';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { AccountScreen, register } from '../AccountScreen';
import { AccountsScreen } from '../AccountsScreen';
import { classifyDroppedFile } from '../AccountImportSheet';

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
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  // Welcome offers only everyday accounts; property is added afterwards (DESIGN page 8).
  await repo.addAccount({ name: 'House', type: 'property', openingBalance: 3_000_000_000n, openingDate: '2026-10-01' });
  const s = await repo.load();
  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
  return { sync, repo, id };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Account page', () => {
  it('P09-01: balance, cleared and not cleared, and a running balance per row', async () => {
    const { sync, repo, id } = await seeded();
    const r = await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Market'), amount: 1_845_000n }],
      date: '2026-10-02',
      payeeName: 'Shoprite',
    });
    if (!r.ok) throw new Error(r.error);
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance' && e.lines.some((l) => l.ledgerAccountId === id('GTBank')))!;
    await repo.setEventMeta(opening.id, { cleared: true });
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    expect(await screen.findByTestId('account-balance')).toHaveTextContent('₦793,850.00');
    expect(screen.getByTestId('account-cleared')).toHaveTextContent(t('account.clearedLine', { cleared: '₦812,300.00', notCleared: '−₦18,450.00' }));
    expect(screen.getByTestId(`running-${r.value.id}`)).toHaveTextContent('₦793,850.00');
    expect(screen.getByTestId(`running-${opening.id}`)).toHaveTextContent('₦812,300.00');
    await fireEvent.press(screen.getByTestId(`reg-${r.value.id}`));
    expect(router.setParams).toHaveBeenCalledWith({ tx: r.value.id });
  });

  it('P08-05 / PU14-1: Update value is offered for property, with a Value tab and delta', async () => {
    const { sync, repo, id } = await seeded();
    setParams({ id: id('House') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('account-more'));
    await fireEvent.press(screen.getByText(t('account.updateValue')));
    expect(router.setParams).toHaveBeenCalledWith({ value: id('House') });
    await act(async () => setParams({ id: id('House'), value: id('House') }));
    expect(await screen.findByTestId('value-delta')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('value-amount'), '35000000');
    await fireEvent.press(screen.getByTestId('value-save'));
    await waitFor(async () => expect(ledgerBalance(id('House'), (await repo.load()).events)).toBe(3_500_000_000n));
    await act(async () => setParams({ id: id('House'), tab: 'value' }));
    expect(await screen.findByTestId('value-list')).toHaveTextContent('+₦5,000,000.00', { exact: false });
  });

  it('a bank account has no Update value or Value tab', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('account-more'));
    expect(screen.queryByText(t('account.updateValue'))).toBeNull();
    expect(screen.queryByText(t('account.tab.value'))).toBeNull();
  });

  it('P08-06 / PU15-1: archiving with money requires a choice; move path works', async () => {
    const { sync, repo, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('account-more'));
    await fireEvent.press(screen.getByText(t('account.archive')));
    expect(screen.getByTestId('archive-save')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('archive-mode-move'));
    expect(screen.getByTestId('archive-save')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('archive-move-to'));
    await fireEvent.press(screen.getByText('OPay'));
    await fireEvent.press(screen.getByTestId('archive-save'));
    await waitFor(async () => expect((await repo.load()).accounts.find((a) => a.name === 'GTBank')?.archived).toBe(true));
    expect(ledgerBalance(id('OPay'), (await repo.load()).events)).toBe(81_230_000n);
    expect(router.push).toHaveBeenCalledWith('/accounts');
  });

  it('PU15-1: archive with balance keeps the money and marks closed with balance', async () => {
    const { sync, repo, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('account-more'));
    await fireEvent.press(screen.getByText(t('account.archive')));
    await fireEvent.press(screen.getByTestId('archive-mode-keep'));
    await fireEvent.press(screen.getByTestId('archive-save'));
    await waitFor(async () => {
      const a = (await repo.load()).accounts.find((x) => x.name === 'GTBank');
      expect(a?.archived).toBe(true);
      expect(a?.closedWithBalance).toBe(true);
    });
    expect(ledgerBalance(id('GTBank'), (await repo.load()).events)).toBe(81_230_000n);
  });

  it('TB03-1: bank shows Transactions and Details only; property shows Value; tab is in the URL', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    const tabs = await screen.findByTestId('account-tabs');
    expect(tabs).toHaveTextContent(t('account.tab.transactions'), { exact: false });
    expect(tabs).toHaveTextContent(t('account.tab.details'), { exact: false });
    expect(tabs).not.toHaveTextContent(t('account.tab.value'), { exact: false });
    await fireEvent.press(screen.getByText(t('account.tab.details')));
    expect(router.setParams).toHaveBeenCalledWith({ tab: 'details' });
  });

  it('PU13-3: last 4 digits refuse more than 4 and never ask for a full number', async () => {
    const { sync } = await seeded();
    setParams({ account: 'new' });
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('add-account-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('type-bank'));
    await fireEvent.changeText(screen.getByTestId('account-last4'), '12345678');
    expect(screen.getByTestId('account-last4')).toHaveDisplayValue('1234');
  });

  it('P09-06: Details shows the bank, the last 4 digits and the currency', async () => {
    const { sync, repo, id } = await seeded();
    const s = await repo.load();
    await repo.updateAccount({ ...s.accounts.find((a) => a.name === 'GTBank')!, institution: 'GTBank', last4: '1234' });
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    await fireEvent.press(await screen.findByText(t('account.tab.details')));
    const details = screen.getByTestId('account-details');
    expect(details).toHaveTextContent('•••1234', { exact: false });
    expect(details).toHaveTextContent('NGN', { exact: false });
    expect(details).toHaveTextContent(t('account.noReconciles'), { exact: false });
    expect(screen.getByTestId('account-bank-status')).toHaveTextContent(t('account.notConnected'));
    expect(screen.getByTestId('account-initials')).toHaveTextContent('GT');
  });

  it('D20 / M19: pending events are left out of the register and running balance', async () => {
    const { repo, id } = await seeded();
    const expense = await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Market'), amount: 1_000_000n }],
      date: '2026-10-05',
      payeeName: 'Pending Shop',
    });
    if (!expense.ok) throw new Error(expense.error);
    const snapshot = await repo.load();
    const pendingEvent = {
      ...expense.value,
      id: 'pending-1',
      operationId: 'pending-1',
      status: 'pending' as const,
      payeeId: expense.value.payeeId,
    };
    const withPending = { ...snapshot, events: [...snapshot.events, pendingEvent] };
    const rows = register(withPending, id('GTBank'));
    expect(rows.find((r) => r.event.id === 'pending-1')).toBeUndefined();
    expect(rows.find((r) => r.event.id === expense.value.id)).toBeTruthy();
    const last = rows[0]!;
    expect(last.running).toBe(ledgerBalance(id('GTBank'), snapshot.events));
  });

  it('TB-03: Search and Filters are on the Transactions tab', async () => {
    const { sync, repo, id } = await seeded();
    await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Market'), amount: 500_000n }],
      date: '2026-10-03',
      payeeName: 'Shoprite',
    });
    setParams({ id: id('GTBank') });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    expect(await screen.findByTestId('account-search')).toBeTruthy();
    expect(screen.getByTestId('account-filters')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('account-search'), 'Shoprite');
    expect(screen.getByText('Shoprite')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('account-search'), 'zzzz-no-match');
    expect(await screen.findByText(t('tx.noMatches'))).toBeTruthy();
  });

  it('P09-07: dropped PDF is classified as a statement, not text', async () => {
    const pdf = {
      name: 'statement.pdf',
      type: 'application/pdf',
      size: 12,
      text: async () => 'NOT-CSV',
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    };
    const result = await classifyDroppedFile(pdf);
    expect(result.kind).toBe('statement');
    if (result.kind === 'statement') {
      expect(result.fileName).toBe('statement.pdf');
      expect(result.base64.length).toBeGreaterThan(0);
    }
  });

  it('P08-07: Reorder mode moves accounts with arrows; rows open the Account page', async () => {
    const { sync, repo, id } = await seeded();
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('reorder-accounts'));
    await fireEvent.press(screen.getByTestId(`down-${id('GTBank')}`));
    await waitFor(async () => expect((await repo.load()).accounts.map((a) => a.name)).toEqual(['OPay', 'GTBank', 'House']));
    await fireEvent.press(screen.getByTestId('reorder-accounts'));
    await fireEvent.press(screen.getByTestId(`account-${id('OPay')}`));
    expect(router.push).toHaveBeenCalledWith(`/accounts/${id('OPay')}`);
  });
});

describe('Import file', () => {
  const csv = 'Date,Narration,Amount\n02/10/2026,POS SHOPRITE LEKKI,-18450\n05/10/2026,Acme salary,640000\nbad,Bolt,-8500\n';

  it('P09-02, P09-03: preview of the rows as read, broken rows reported, duplicates struck through and unticked', async () => {
    const { sync, repo, id } = await seeded();
    await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Market'), amount: 1_845_000n }],
      date: '2026-10-01',
      payeeName: 'Shoprite',
    });
    const account = (await repo.load()).accounts.find((a) => a.name === 'GTBank')!;
    const onImported = jest.fn();
    await renderWithProviders(wrap(<ImportSheet account={account} initialText={csv} onClose={jest.fn()} onImported={onImported} />), { sync });
    const preview = await screen.findByTestId('import-preview');
    expect(preview).toHaveTextContent('−₦18,450.00', { exact: false });
    expect(preview).toHaveTextContent('+₦640,000.00', { exact: false });
    expect(screen.getByTestId('import-broken')).toHaveTextContent(t('import.broken', { lines: '4' }));
    await fireEvent.press(screen.getByTestId('import-next'));
    expect(screen.getByTestId('import-counts')).toHaveTextContent(
      t('import.countsPhrase', { fresh: 1, duplicates: 1, rules: 0, broken: 1 }),
    );
    expect(screen.getByTestId('review-tick-2')).not.toBeChecked();
    expect(screen.getByTestId('review-tick-3')).toBeChecked();
    await fireEvent.press(screen.getByTestId('import-post'));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(expect.any(String), 1));
    expect(await screen.findByTestId('import-done-close')).toBeTruthy();
    const s = await repo.load();
    expect(ledgerBalance(id('GTBank'), s.events)).toBe(81_230_000n - 1_845_000n + 64_000_000n);
    expect(s.accounts.find((a) => a.name === 'GTBank')?.importMapping).toMatchObject({ date: 0, amount: 2, description: 1 });
  });
});
