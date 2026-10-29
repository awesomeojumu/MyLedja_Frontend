import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams } from '../../../../test/helpers/router';
import { AddTransactionProvider } from '../AddTransaction';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

beforeEach(() => {
  resetParams();
});

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
  const accountId = s.accounts[0]!.id;
  const marketId = s.categories.find((c) => c.name === 'Market')!.id;
  const rentId = s.categories.find((c) => c.name === 'Rent')!.id;
  await repo.addTransaction({ kind: 'expense', accountId, parts: [{ categoryId: marketId, amount: 5_000_000n }], date: '2026-10-12', payeeName: 'Shoprite' });
  await repo.addTransaction({ kind: 'expense', accountId, parts: [{ categoryId: rentId, amount: 2_000_000n }], date: '2026-10-15', payeeName: 'Landlord' });
  return { sync, repo, marketId, rentId };
}

describe('Transactions filters and bulk', () => {
  it('P11-03: filter chips narrow the list', async () => {
    const { sync, rentId } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('tx-filters'));
    await fireEvent.press(screen.getByTestId(`tx-filter-category-${rentId}`));
    await fireEvent.press(screen.getByTestId('tx-filters-apply'));
    await waitFor(() => {
      expect(screen.queryByText('Shoprite')).toBeNull();
      expect(screen.getByText('Landlord')).toBeTruthy();
    });
  });

  it('P11-08: bulk categorize selected rows via floating bar', async () => {
    const { sync, repo, marketId, rentId } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('tx-select'));
    const rows = (await repo.load()).events.filter((e) => e.type === 'expense');
    for (const e of rows) {
      await fireEvent.press(screen.getByTestId(`select-${e.id}`));
    }
    await fireEvent.press(screen.getByTestId('tx-float-categorize'));
    await fireEvent.press(screen.getByTestId('tx-bulk-value'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Rent' }));
    await fireEvent.press(screen.getByTestId('tx-bulk-apply'));
    await waitFor(async () => {
      const after = await repo.load();
      const expenses = after.events.filter((e) => e.type === 'expense' && e.status === 'posted');
      expect(expenses.every((e) => e.lines.some((l) => l.ledgerAccountId === rentId))).toBe(true);
    });
    void marketId;
    expect(await screen.findByText(t('tx.bulk.changed', { count: 2 }))).toBeTruthy();
  });
});
