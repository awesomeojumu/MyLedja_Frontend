import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { AddTransactionProvider } from '@/features/transactions/AddTransaction';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { CommandBar } from '../CommandBar';
import { clearRecentSearchesForTests, searchWorkspace } from '../searchIndex';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/lib/useOnline', () => ({ useOnline: () => true }));

let mockWidth = 1100;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.rent', group: 'group.home', name: 'Rent' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const rent = s.categories.find((c) => c.name === 'Rent')!;
  const accountId = s.accounts[0]!.id;
  await repo.addRecurring({
    kind: 'bill',
    name: 'Rent',
    amountMinor: '25000000',
    accountId,
    categoryId: rent.id,
    rule: { every: 'month', on: 1 },
    startDate: '2026-10-01',
  });
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: rent.id, amount: 250_000_00n }],
    date: '2026-10-01',
    payeeName: 'Rent',
  });
  return { sync, repo };
}

function wrap(ui: React.ReactElement) {
  return (
    <WorkspaceProvider workspaceId="ws-personal">
      <AddTransactionProvider>{ui}</AddTransactionProvider>
    </WorkspaceProvider>
  );
}

beforeEach(() => {
  resetParams();
  clearRecentSearchesForTests();
  jest.clearAllMocks();
  mockWidth = 1100;
});

describe('Command bar (PU-03)', () => {
  it('PU03-1: typing rent shows category, bill and transactions; Enter opens the first result', async () => {
    const { sync, repo } = await seeded();
    const snapshot = await repo.load();
    const groups = searchWorkspace(snapshot, 'rent');
    expect(groups.find((g) => g.id === 'categories')?.hits.some((h) => h.label === 'Rent')).toBe(true);
    expect(groups.find((g) => g.id === 'actions')?.hits.some((h) => h.label === t('command.action.markBillPaid', { bill: 'Rent' }))).toBe(true);
    expect(groups.find((g) => g.id === 'transactions')?.hits.some((h) => /rent/i.test(h.label))).toBe(true);

    await renderWithProviders(wrap(<CommandBar />), { sync });
    await act(async () => setParams({ search: 'rent' }));
    expect(await screen.findByTestId('command-bar')).toBeTruthy();
    expect(screen.getByTestId('command-group-categories')).toBeTruthy();
    expect(screen.getByTestId('command-group-actions')).toBeTruthy();
    expect(screen.getByTestId('command-group-transactions')).toBeTruthy();
    expect(screen.getByText(t('command.action.markBillPaid', { bill: 'Rent' }))).toBeTruthy();
    expect(screen.getAllByText('Rent').length).toBeGreaterThan(0);

    const first = groups.flatMap((g) => g.hits)[0]!;
    await fireEvent.press(screen.getByTestId(`command-hit-${first.id}`));
    await waitFor(() => expect(screen.queryByTestId('command-bar')).toBeNull());
  });

  it('PU03-2: Add expense opens PU-01 on the Expense tab', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<CommandBar />), { sync });
    await act(async () => setParams({ search: 'Add expense' }));
    expect(await screen.findByTestId('command-bar')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('command-hit-action-add-expense'));
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ add: 'expense' }));
  });

  it('PU03-3: search works offline on device snapshot data', async () => {
    const { repo } = await seeded();
    const snapshot = await repo.load();
    const groups = searchWorkspace(snapshot, 'rent');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((g) => g.hits.length > 0)).toBe(true);
  });

  it('phone top bar shows a search icon that opens the command bar', async () => {
    mockWidth = 375;
    const { sync } = await seeded();
    await renderWithProviders(
      wrap(
        <AppFrame title={t('dashboard.title')}>
          {null}
        </AppFrame>,
      ),
      { sync },
    );
    await fireEvent.press(screen.getByTestId('command-open'));
    expect(router.setParams).toHaveBeenCalledWith({ search: '' });
  });
});
