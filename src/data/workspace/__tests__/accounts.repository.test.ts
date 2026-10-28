import { MockSyncServer } from '@/api/mocks/sync';
import { ledgerBalance, monthIncome, monthSpent, netWorth, periodTotals } from '@/ledger';

import { MemoryKeyValue } from '../../kv.shared';
import { LocalStore } from '../../sync/LocalStore';
import { SyncEngine } from '../../sync/SyncEngine';
import type { ImportMapping } from '../model';
import { WorkspaceRepository } from '../repository';

const mapping: ImportMapping = {
  date: 0,
  amount: 2,
  moneyIn: null,
  moneyOut: null,
  description: 1,
  payee: null,
  notes: null,
  dateFormat: 'DD/MM/YYYY',
  hasHeader: true,
};

async function setup() {
  const store = new LocalStore(new MemoryKeyValue());
  const engine = new SyncEngine({ store, transport: new MockSyncServer(), deviceId: 'd' });
  const repo = new WorkspaceRepository(store, engine, 'ws');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-10-01' },
      { name: 'OPay', type: 'wallet', openingBalance: '0', openingDate: '2026-10-01' },
      { name: 'House', type: 'property', openingBalance: '3000000000', openingDate: '2026-10-01' },
      { name: 'Card', type: 'card', openingBalance: '5000000', openingDate: '2026-10-01' },
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
  return { repo, id };
}

describe('Accounts in the repository', () => {
  it('P08-05: Update value changes net worth, never income or spending', async () => {
    const { repo, id } = await setup();
    const before = netWorth((await repo.load()).chart, (await repo.load()).events, '9999-12-31').total;
    const r = await repo.updateValue(id('House'), 3_500_000_000n, '2026-10-20');
    expect(r.ok).toBe(true);
    const s = await repo.load();
    expect(ledgerBalance(id('House'), s.events)).toBe(3_500_000_000n);
    expect(netWorth(s.chart, s.events, '9999-12-31').total - before).toBe(500_000_000n);
    const totals = periodTotals(s.events);
    expect(monthIncome(s.chart, totals, '2026-10')).toBe(0n);
    expect(monthSpent(s.chart, totals, '2026-10')).toBe(0n);
    expect(await repo.updateValue(id('House'), 3_500_000_000n, '2026-10-21')).toEqual({ ok: true, value: null });
  });

  it('P08-06: archiving with money in it needs somewhere to move it, then moves it', async () => {
    const { repo, id } = await setup();
    expect((await repo.archiveAccount(id('GTBank'), '2026-10-28')).ok).toBe(false);
    expect((await repo.archiveAccount(id('GTBank'), '2026-10-28', id('OPay'))).ok).toBe(true);
    const s = await repo.load();
    expect(s.accounts.find((a) => a.name === 'GTBank')?.archived).toBe(true);
    expect(ledgerBalance(id('GTBank'), s.events)).toBe(0n);
    expect(ledgerBalance(id('OPay'), s.events)).toBe(81_230_000n);
  });

  it('archiving a card that is owed pays it off from the chosen account', async () => {
    const { repo, id } = await setup();
    expect((await repo.archiveAccount(id('Card'), '2026-10-28', id('GTBank'))).ok).toBe(true);
    const s = await repo.load();
    expect(ledgerBalance(id('Card'), s.events)).toBe(0n);
    expect(ledgerBalance(id('GTBank'), s.events)).toBe(76_230_000n);
  });

  it('archiving an empty account needs no move', async () => {
    const { repo, id } = await setup();
    expect((await repo.archiveAccount(id('OPay'), '2026-10-28')).ok).toBe(true);
  });

  it('P08-07: reorder', async () => {
    const { repo, id } = await setup();
    await repo.reorderAccounts([id('Card'), id('GTBank'), id('OPay'), id('House')]);
    expect((await repo.load()).accounts.map((a) => a.name)).toEqual(['Card', 'GTBank', 'OPay', 'House']);
  });

  it('P09-04, P09-05: an import posts as one batch, remembers its mapping, and Undo removes it and nothing else', async () => {
    const { repo, id } = await setup();
    const own = await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Market'), amount: 100_000n }],
      date: '2026-10-02',
    });
    expect(own.ok).toBe(true);
    const r = await repo.importRows(
      id('GTBank'),
      [
        { date: '2026-10-03', amount: -1_845_000n, categoryId: id('Market'), payeeName: 'Shoprite' },
        { date: '2026-10-04', amount: 64_000_000n, categoryId: (await repo.load()).categories.find((c) => c.kind === 'income')!.id, payeeName: 'Acme' },
      ],
      mapping,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.value.count).toBe(2);
    let s = await repo.load();
    expect(s.accounts.find((a) => a.name === 'GTBank')?.importMapping).toEqual(mapping);
    expect(s.payees.map((p) => p.name).sort()).toEqual(['Acme', 'Shoprite']);
    expect(ledgerBalance(id('GTBank'), s.events)).toBe(81_230_000n - 100_000n - 1_845_000n + 64_000_000n);
    expect(await repo.undoImport(r.value.importId, '2026-10-28')).toBe(2);
    s = await repo.load();
    expect(ledgerBalance(id('GTBank'), s.events)).toBe(81_230_000n - 100_000n);
    expect(s.events.find((e) => own.ok && e.id === own.value.id)?.status).toBe('posted');
  });

  it('cleared and reconciled marks change in place without touching a figure', async () => {
    const { repo, id } = await setup();
    const opening = (await repo.load()).events.find((e) => e.lines.some((l) => l.ledgerAccountId === id('GTBank')))!;
    await repo.setEventMeta(opening.id, { cleared: true });
    const s = await repo.load();
    expect(s.events.find((e) => e.id === opening.id)?.cleared).toBe(true);
    expect(s.events).toHaveLength(3);
  });
});
