import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { AddTransactionProvider } from '../AddTransaction';
import { today } from '../helpers';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

let mockSizeClass = 'phone';
jest.mock('@/design/size', () => ({
  ...jest.requireActual('@/design/size'),
  useSizeClass: () => mockSizeClass,
}));

async function seeded(withTx = true) {
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
  let txId = '';
  if (withTx) {
    const s = await repo.load();
    const accountId = s.accounts[0]!.id;
    const categoryId = s.categories.find((c) => c.name === 'Market')!.id;
    const res = await repo.addTransaction({
      kind: 'expense',
      accountId,
      date: today(),
      payeeName: 'Shoprite Lekki',
      parts: [{ categoryId, amount: 1845000n }],
    });
    if (res.ok) txId = res.value.id;
  }
  return { sync, repo, txId };
}

async function show(sync: ReturnType<typeof memorySync>) {
  await renderWithProviders(
    <WorkspaceProvider workspaceId="ws-personal">
      <AddTransactionProvider>
        <TransactionsScreen />
      </AddTransactionProvider>
    </WorkspaceProvider>,
    { sync },
  );
}

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
  mockSizeClass = 'phone';
});

describe('Page 11 redesign Transactions (EXPO_PUBLIC_REDESIGN on)', () => {
  it('renders Figma list chrome: period chips, search and filter actions', async () => {
    const { sync } = await seeded();
    await show(sync);
    expect(await screen.findByTestId('redesign-transactions')).toBeTruthy();
    expect(screen.getByTestId('tx-period-thisMonth')).toBeTruthy();
    expect(screen.getByTestId('tx-period-last3Months')).toBeTruthy();
    expect(screen.getByTestId('tx-period-thisYear')).toBeTruthy();
    expect(screen.getByTestId('tx-period-all')).toBeTruthy();
    expect(screen.getByTestId('tx-search-btn')).toBeTruthy();
    expect(screen.getByTestId('tx-filters')).toBeTruthy();
    expect(router.setParams).toHaveBeenCalled();
  });

  it('shows day header Today and phone row subtitle Category, Account', async () => {
    const { sync } = await seeded();
    await show(sync);
    await waitFor(() => expect(screen.getByText(t('date.today'))).toBeTruthy());
    expect(await screen.findByText('Shoprite Lekki')).toBeTruthy();
    // Figma 2:1549 — subtitle is "{Category}, {Account}"
    expect(screen.getByText('Market, GTBank')).toBeTruthy();
  });

  it('uses Figma waiting and offline copy strings', () => {
    expect(t('tx.redesign.waitingBanner', { count: 2 })).toBe('2 changes waiting to sync');
    expect(t('tx.redesign.offline')).toBe('You are offline. New transactions are saved on this phone.');
  });

  it('opens search mode from the top bar', async () => {
    const { sync } = await seeded();
    await show(sync);
    await fireEvent.press(await screen.findByTestId('tx-search-btn'));
    expect(await screen.findByTestId('redesign-tx-search')).toBeTruthy();
    expect(screen.getByTestId('tx-search')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('tx-search'), 'Shop');
    expect(await screen.findByText('Shoprite Lekki')).toBeTruthy();
  });

  it('empty state uses Figma copy and doors', async () => {
    const { sync } = await seeded(false);
    await show(sync);
    expect(await screen.findByText(t('tx.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('tx.redesign.emptyBody'))).toBeTruthy();
    expect(screen.getByText(t('tx.redesign.importFile'))).toBeTruthy();
    expect(screen.getByText(t('tx.add'))).toBeTruthy();
    expect(screen.getByText(t('tx.redesign.connectBank'))).toBeTruthy();
  });

  it('period All clears the date filter', async () => {
    const { sync } = await seeded();
    await show(sync);
    await fireEvent.press(await screen.findByTestId('tx-period-all'));
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ from: undefined, to: undefined }));
  });

  it('displays payee avatars, micro-badges, and filter summary strip', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    const cat = snap.categories[0]!;
    const acc = snap.accounts[0]!;
    // Add transaction with receipt note
    await repo.addTransaction({
      kind: 'expense',
      accountId: acc.id,
      date: today(),
      payeeName: 'Total Energies',
      notes: 'receipt:http://example.com/receipt.jpg',
      parts: [{ categoryId: cat.id, amount: 2500000n }],
    });

    await show(sync);
    expect(await screen.findByTestId('tx-filter-summary-strip')).toBeTruthy();
    expect(screen.getByText(t('tx.redesign.summaryInflow') + ':')).toBeTruthy();
    expect(screen.getByText(t('tx.redesign.summaryOutflow') + ':')).toBeTruthy();
    expect(screen.getByText(t('tx.redesign.summaryNet') + ':')).toBeTruthy();

    // Verify receipt micro badge
    expect(await screen.findByTestId('tx-badge-receipt')).toBeTruthy();
  });

  it('supports multi-select mode and floating bulk action bar with mark cleared', async () => {
    const { sync, txId } = await seeded();
    await show(sync);
    const row = await screen.findByTestId(`tx-${txId}`);
    // Long press to enter select mode
    await fireEvent(row, 'longPress');
    expect(await screen.findByTestId('tx-float-bar')).toBeTruthy();
    expect(screen.getByTestId('tx-float-reconcile')).toBeTruthy();
    expect(screen.getByTestId('tx-float-tag')).toBeTruthy();
    expect(screen.getByTestId('tx-float-delete')).toBeTruthy();

    // Click mark cleared
    await fireEvent.press(screen.getByTestId('tx-float-reconcile'));
    await waitFor(() => {
      expect(screen.queryByTestId('tx-float-bar')).toBeNull();
    });
  });

  it('renders desktop table view with column sorting and quick-add row', async () => {
    mockSizeClass = 'desktop';
    const { sync, repo } = await seeded();
    await show(sync);

    expect(await screen.findByTestId('tx-table-header')).toBeTruthy();
    expect(screen.getByTestId('tx-sort-date')).toBeTruthy();
    expect(screen.getByTestId('tx-sort-payee')).toBeTruthy();
    expect(screen.getByTestId('tx-sort-amount')).toBeTruthy();

    // Quick add row
    expect(screen.getByTestId('tx-quick-add-row')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('tx-quick-add-payee'), 'Ikeja Electric');
    await fireEvent.changeText(screen.getByTestId('tx-quick-add-amount'), '15000');
    await fireEvent.press(screen.getByTestId('tx-quick-add-save'));

    await waitFor(async () => {
      const updated = await repo.load();
      expect(updated.events.some((e) => e.lines.length > 0 && updated.payees.some((p) => p.name === 'Ikeja Electric'))).toBe(true);
    });
  });

  it('docks TransactionPanel side-by-side on desktop when a transaction is opened', async () => {
    mockSizeClass = 'desktop';
    const { sync, txId } = await seeded();
    setParams({ tx: txId, txn: txId });
    await show(sync);

    expect(await screen.findByTestId('tx-panel')).toBeTruthy();
    expect(screen.getByTestId('redesign-transactions')).toBeTruthy();
  });
});
