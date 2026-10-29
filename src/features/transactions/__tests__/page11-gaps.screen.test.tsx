import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { AddTransactionProvider } from '../AddTransaction';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

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
  const r = await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 5_000_000n }],
    date: '2026-10-12',
    payeeName: 'Shoprite',
  });
  if (!r.ok) throw new Error(r.error);
  return { sync, repo, id: r.value.id, marketId, accountId };
}

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Page 11 FE gaps', () => {
  it('shows waiting banner when events are waiting to sync', async () => {
    const { sync, repo } = await seeded();
    // Fresh local events stay in waiting until sync acks them.
    expect((await repo.load()).waiting.size).toBeGreaterThan(0);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('tx-waiting-banner')).toBeTruthy();
  });

  it('floating bar offers categorize and create-rule actions', async () => {
    const { sync, repo, id } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('tx-select'));
    await fireEvent.press(screen.getByTestId(`select-${id}`));
    expect(await screen.findByTestId('tx-float-bar')).toBeTruthy();
    expect(screen.getByTestId('tx-float-categorize')).toBeTruthy();
    expect(screen.getByTestId('tx-float-rule')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tx-float-rule'));
    await waitFor(async () => {
      const rules = (await repo.load()).rules;
      expect(rules.length).toBeGreaterThan(0);
    });
    expect(router.push).toHaveBeenCalled();
  });

  it('panel new-rule and always-use-category actions', async () => {
    const { sync, repo, id, marketId } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    await act(async () => router.setParams({ tx: id, txn: id }));
    expect(await screen.findByTestId('panel-always-category')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('panel-always-category'));
    await waitFor(async () => {
      const payee = (await repo.load()).payees.find((p) => p.name === 'Shoprite');
      expect(payee?.defaultCategoryId).toBe(marketId);
    });
    await fireEvent.press(screen.getByTestId('panel-new-rule'));
    await waitFor(async () => expect((await repo.load()).rules.length).toBeGreaterThan(0));
    expect(router.push).toHaveBeenCalled();
  });

  it('long-press enters select mode', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent(screen.getByTestId(`open-${id}`), 'longPress');
    expect(await screen.findByTestId(`select-${id}`)).toBeTruthy();
    expect(screen.getByTestId('tx-float-bar')).toBeTruthy();
  });

  it('shows glyph marks with a11y words', async () => {
    const { sync, repo, id } = await seeded();
    await repo.updateNotes(id, 'receipt:https://example.com/r.jpg');
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    const marks = await screen.findByTestId(`tx-marks-${id}`);
    expect(marks.props.children).toContain('📎');
    expect(marks.props.accessibilityLabel).toContain(t('tx.mark.receipt'));
  });

  it('swipe row exposes categorize and delete actions', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <AddTransactionProvider>
          <TransactionsScreen />
        </AddTransactionProvider>
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId(`tx-swipe-${id}`)).toBeTruthy();
    expect(screen.getByTestId(`tx-swipe-${id}-categorize`)).toBeTruthy();
    expect(screen.getByTestId(`tx-swipe-${id}-delete`)).toBeTruthy();
  });

  it('stamps createdBy and deviceId on new events for history', async () => {
    const { repo, accountId, marketId } = await seeded();
    repo.setActor({ userId: 'user-ada' });
    const r = await repo.addTransaction({
      kind: 'expense',
      accountId,
      parts: [{ categoryId: marketId, amount: 1_000_00n }],
      date: '2026-10-13',
      payeeName: 'Bolt',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.createdBy).toBe('user-ada');
    expect(r.value.deviceId).toBe('test');
    const loaded = (await repo.load()).events.find((e) => e.id === r.value.id);
    expect(loaded?.createdBy).toBe('user-ada');
    expect(loaded?.deviceId).toBe('test');
  });
});
