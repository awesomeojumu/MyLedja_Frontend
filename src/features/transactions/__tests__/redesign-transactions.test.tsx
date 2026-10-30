import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { AddTransactionProvider } from '../AddTransaction';
import { today } from '../helpers';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

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
  if (withTx) {
    const s = await repo.load();
    const accountId = s.accounts[0]!.id;
    const categoryId = s.categories.find((c) => c.name === 'Market')!.id;
    await repo.addTransaction({
      kind: 'expense',
      accountId,
      date: today(),
      payeeName: 'Shoprite Lekki',
      parts: [{ categoryId, amount: 1845000n }],
    });
  }
  return { sync, repo };
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
});
