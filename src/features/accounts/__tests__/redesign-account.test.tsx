import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { AccountScreen } from '../AccountScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

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
  const snap = await repo.load();
  const id = snap.accounts[0]!.id;
  const categoryId = snap.categories[0]!.id;
  return { sync, repo, id, categoryId, snap };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Page 09 redesign Account', () => {
  it('renders balance card, Reconcile, Import a file, and register headers', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    expect(await screen.findByTestId('redesign-account-balance')).toBeTruthy();
    expect(screen.getByTestId('account-balance')).toBeTruthy();
    expect(screen.getByText(t('redesign.account.reconcile'))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.import'))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.transactions'))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.balanceAfter'))).toBeTruthy();
    expect(screen.getByTestId('account-back')).toBeTruthy();
    expect(screen.getByTestId('account-more')).toBeTruthy();
  });

  it('renders Cleared vs Uncleared breakdown pill, sync indicator, and overdue warning', async () => {
    const { sync, repo, id, categoryId } = await seeded();
    const r = await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 500000n }],
      date: '2026-10-02',
      payeeName: 'Grocery Store',
    });
    if (r.ok) {
      await repo.setEventMeta(r.value.id, { cleared: true });
    }
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });

    expect(await screen.findByTestId('account-cleared-split')).toBeTruthy();
    expect(screen.getByTestId('account-cleared-amount')).toBeTruthy();
    expect(screen.getByTestId('account-uncleared-amount')).toBeTruthy();
    expect(screen.getByTestId('account-sync-indicator')).toBeTruthy();
    expect(screen.getByTestId('account-sync-button')).toBeTruthy();
    expect(screen.getByTestId('account-last-reconciled')).toBeTruthy();
    expect(screen.getByTestId('account-reconcile-aging-warning')).toBeTruthy();
  });

  it('renders 30-day cash flow card with metrics and sparkline', async () => {
    const { sync, repo, id, categoryId } = await seeded();
    await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 200000n }],
      date: '2026-10-03',
      payeeName: 'Fuel Station',
    });
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });

    expect(await screen.findByTestId('account-cashflow-card')).toBeTruthy();
    expect(screen.getByTestId('account-balance-sparkline')).toBeTruthy();
    expect(screen.getByTestId('account-inflow-total')).toBeTruthy();
    expect(screen.getByTestId('account-outflow-total')).toBeTruthy();
    expect(screen.getByTestId('account-net-change')).toBeTruthy();
  });

  it('filters transactions by search query', async () => {
    const { sync, repo, id, categoryId } = await seeded();
    await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 150000n }],
      date: '2026-10-04',
      payeeName: 'Alpha Coffee',
    });
    await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 450000n }],
      date: '2026-10-05',
      payeeName: 'Beta Electronics',
    });

    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });

    const searchInput = await screen.findByTestId('account-tx-search');
    expect(searchInput).toBeTruthy();
    expect(screen.getByText('Alpha Coffee')).toBeTruthy();
    expect(screen.getByText('Beta Electronics')).toBeTruthy();

    fireEvent.changeText(searchInput, 'Alpha');
    await waitFor(() => {
      expect(screen.getByText('Alpha Coffee')).toBeTruthy();
      expect(screen.queryByText('Beta Electronics')).toBeNull();
    });
  });

  it('filters transactions by cleared chip', async () => {
    const { sync, repo, id, categoryId } = await seeded();
    const t1 = await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 150000n }],
      date: '2026-10-04',
      payeeName: 'Alpha Coffee',
    });
    await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 450000n }],
      date: '2026-10-05',
      payeeName: 'Beta Electronics',
    });
    if (t1.ok) await repo.setEventMeta(t1.value.id, { cleared: true });

    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });

    const clearedChip = await screen.findByTestId('account-filter-cleared');
    expect(clearedChip).toBeTruthy();

    fireEvent.press(clearedChip);
    await waitFor(() => {
      expect(screen.getByText('Alpha Coffee')).toBeTruthy();
      expect(screen.queryByText('Beta Electronics')).toBeNull();
    });
  });

  it('groups register by day and displays day net header', async () => {
    const { sync, repo, id, categoryId } = await seeded();
    await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 250000n }],
      date: '2026-10-10',
      payeeName: 'Bookstore',
    });
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });

    expect(await screen.findByTestId('day-header-2026-10-10')).toBeTruthy();
    expect(screen.getByText('Bookstore')).toBeTruthy();
  });

  it('toggles transaction cleared status when pressing row cleared button', async () => {
    const { sync, repo, id, categoryId } = await seeded();
    const t1 = await repo.addTransaction({
      kind: 'expense',
      accountId: id,
      parts: [{ categoryId, amount: 300000n }],
      date: '2026-10-12',
      payeeName: 'Bakery',
    });
    const txId = t1.ok ? t1.value.id : '';

    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });

    const toggleBtn = await screen.findByTestId(`account-toggle-cleared-${txId}`);
    expect(toggleBtn).toBeTruthy();
    fireEvent.press(toggleBtn);

    await waitFor(async () => {
      const snap = await repo.load();
      const ev = snap.events.find((e) => e.id === txId);
      expect(ev?.cleared).toBe(true);
    });
  });

  it('renders quick Add Transaction button', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });

    const addBtn = await screen.findByTestId('account-add-tx');
    expect(addBtn).toBeTruthy();
    fireEvent.press(addBtn);
  });

  it('More opens Delete dialog with Figma copy, confirm opens archive path', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('account-more'));
    expect(await screen.findByTestId('account-more-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('more-delete'));
    expect(await screen.findByText(t('redesign.account.deleteTitle', { name: 'GTBank Current' }))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.deleteConfirm'))).toBeTruthy();
    await fireEvent.press(screen.getByText(t('redesign.account.deleteConfirm')));
    await waitFor(() => expect(screen.getByTestId('archive-sheet')).toBeTruthy());
  });
});
