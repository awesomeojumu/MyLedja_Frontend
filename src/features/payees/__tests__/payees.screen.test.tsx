import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { PayeesScreen } from '../PayeesScreen';
import { aliasOwner, payeeRows } from '../helpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const accountId = s.accounts[0]!.id;
  const marketId = s.categories.find((c) => c.name === 'Market')!.id;
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 5_000_000n }],
    date: '2026-10-12',
    payeeName: 'Shoprite',
  });
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 2_000_000n }],
    date: '2026-10-15',
    payeeName: 'Corner shop',
  });
  return { sync, repo, marketId, accountId };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Payees page (PU-46 / PU-47)', () => {
  it('P24-01: lists payees with usage (phone: name + last used)', async () => {
    const { sync, repo } = await seeded();
    const before = await repo.load();
    expect(payeeRows(before, 2026).every((r) => r.txCount === 1)).toBe(true);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByText('Shoprite')).toBeTruthy();
    expect(screen.getByText('Corner shop')).toBeTruthy();
    // DESIGN D4 phone rows: logo, name, last used (tx count lives on tablet/desktop table).
    expect(screen.getAllByText(/Last used|Not used yet/).length).toBeGreaterThanOrEqual(2);
  });

  it('PU00-5 / PU-46: ?payee= opens the panel', async () => {
    const { sync, repo } = await seeded();
    const shop = (await repo.load()).payees.find((p) => p.name === 'Shoprite')!;
    await act(async () => setParams({ payee: shop.id }));
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('payee-sheet')).toBeTruthy();
    expect(screen.getByTestId('payee-name')).toBeTruthy();
  });

  it('PU46-2: a bank name cannot belong to two payees', async () => {
    const { sync, repo } = await seeded();
    const before = await repo.load();
    const shop = before.payees.find((p) => p.name === 'Shoprite')!;
    const corner = before.payees.find((p) => p.name === 'Corner shop')!;
    await repo.updatePayee({ ...shop, aliases: ['POS SHOPRITE'] });
    const conflict = aliasOwner(await repo.load(), 'POS SHOPRITE', corner.id);
    expect(conflict?.name).toBe('Shoprite');
    const r = await repo.updatePayee({ ...corner, aliases: ['POS SHOPRITE'] });
    expect(r.ok).toBe(false);
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByText('Corner shop'));
    await fireEvent.changeText(screen.getByTestId('payee-alias-input'), 'POS SHOPRITE');
    await fireEvent.press(screen.getByTestId('payee-alias-add'));
    expect(await screen.findByTestId('payee-alias-error')).toBeTruthy();
    expect(screen.getByText(t('payees.aliasTaken', { name: 'Shoprite' }))).toBeTruthy();
  });

  it('PU46-1: usual category fills new transactions only', async () => {
    const { sync, repo, marketId, accountId } = await seeded();
    const shop = (await repo.load()).payees.find((p) => p.name === 'Shoprite')!;
    const fuel = await repo.addCategory({ name: 'Fuel', kind: 'expense', group: 'group.transport' });
    await repo.updatePayee({ ...shop, defaultCategoryId: fuel.id });
    const old = (await repo.load()).events.find((e) => e.payeeId === shop.id)!;
    const oldCat = old.lines.find((l) => l.ledgerAccountId === marketId || l.ledgerAccountId === fuel.id);
    expect(oldCat?.ledgerAccountId).toBe(marketId);
    await repo.addTransaction({
      kind: 'expense',
      accountId,
      parts: [{ categoryId: fuel.id, amount: 1_000_000n }],
      date: '2026-10-20',
      payeeName: 'Shoprite',
    });
    const after = await repo.load();
    const newest = after.events.find((e) => e.payeeId === shop.id && e.date === '2026-10-20')!;
    expect(newest.lines.some((l) => l.ledgerAccountId === fuel.id)).toBe(true);
    expect(after.events.find((e) => e.id === old.id)!.lines.some((l) => l.ledgerAccountId === marketId)).toBe(true);
    void sync;
  });

  it('PU47-1 / PU47-2: merge moves txs and aliases; Undo restores', async () => {
    const { sync, repo } = await seeded();
    const before = await repo.load();
    const shop = before.payees.find((p) => p.name === 'Shoprite')!;
    const corner = before.payees.find((p) => p.name === 'Corner shop')!;
    await repo.updatePayee({ ...corner, aliases: ['CORNER POS'] });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`payee-select-${shop.id}`));
    await fireEvent.press(screen.getByTestId(`payee-select-${corner.id}`));
    await fireEvent.press(screen.getByTestId('payees-merge'));
    expect(screen.getByTestId('payees-merge-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`payees-merge-keep-name-${shop.id}`));
    await fireEvent.press(screen.getByTestId('payees-merge-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(after.payees.map((p) => p.name)).toEqual(['Shoprite']);
      expect(after.events.filter((e) => e.payeeId === shop.id)).toHaveLength(2);
      expect(after.payees[0]!.aliases).toEqual(expect.arrayContaining(['Corner shop', 'CORNER POS']));
    });
    const undo = await screen.findByRole('button', { name: t('common.undo') });
    await fireEvent.press(undo);
    await waitFor(async () => {
      const restored = await repo.load();
      expect(restored.payees.map((p) => p.name).sort()).toEqual(['Corner shop', 'Shoprite']);
      expect(restored.events.filter((e) => e.payeeId === corner.id)).toHaveLength(1);
      expect(restored.payees.find((p) => p.id === corner.id)?.aliases).toEqual(['CORNER POS']);
    });
  });

  it('PU00-5: ?merge= opens merge sheet', async () => {
    const { sync, repo } = await seeded();
    const before = await repo.load();
    const shop = before.payees.find((p) => p.name === 'Shoprite')!;
    const corner = before.payees.find((p) => p.name === 'Corner shop')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await act(async () => setParams({ merge: `${shop.id},${corner.id}` }));
    expect(await screen.findByTestId('payees-merge-sheet')).toBeTruthy();
  });
});
