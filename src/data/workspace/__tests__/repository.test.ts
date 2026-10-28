import { MockSyncServer } from '@/api/mocks/sync';
import { categoryActivity, ledgerBalance, monthIncome, monthSpent, periodTotals } from '@/ledger';

import { MemoryKeyValue } from '../../kv.shared';
import { LocalStore } from '../../sync/LocalStore';
import { SyncEngine } from '../../sync/SyncEngine';
import { WorkspaceRepository } from '../repository';

async function setup() {
  const store = new LocalStore(new MemoryKeyValue());
  const server = new MockSyncServer();
  const engine = new SyncEngine({ store, transport: server, deviceId: 'd' });
  const repo = new WorkspaceRepository(store, engine, 'ws');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-10-01' },
      { name: 'Card', type: 'card', openingBalance: '0', openingDate: '2026-10-01' },
    ],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.rent', group: 'group.home', name: 'Rent' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
  return { repo, store, engine, server, id };
}

describe('WorkspaceRepository', () => {
  it('seeds once, with opening balances that are not income (case 19)', async () => {
    const { repo, id } = await setup();
    await repo.seedFromSetup({ workspaceName: '', currency: 'NGN', weekStart: 'monday', accounts: [], categories: [], budgetStyle: 'tracking', monthlyTakeHome: null, skippedSteps: [] });
    const s = await repo.load();
    expect(s.categories.filter((c) => c.kind === 'expense')).toHaveLength(2);
    expect(s.categories.filter((c) => c.kind === 'income').map((c) => c.name)).toEqual(['Salary', 'Business income', 'Gifts received', 'Other income']);
    expect(ledgerBalance(id('GTBank'), s.events)).toBe(81230000n);
    expect(monthIncome(s.chart, periodTotals(s.events), '2026-10')).toBe(0n);
  });

  it('records expenses, splits and transfers with the right totals', async () => {
    const { repo, id } = await setup();
    await repo.addTransaction({ kind: 'expense', accountId: id('Card'), parts: [{ categoryId: id('Market'), amount: 1_845_000n }], date: '2026-10-28', payeeName: 'Shoprite Lekki' });
    const split = await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [
        { categoryId: id('Market'), amount: 300_000n },
        { categoryId: id('Rent'), amount: 600_000n },
      ],
      date: '2026-10-28',
    });
    expect(split.ok).toBe(true);
    await repo.addTransaction({ kind: 'transfer', fromId: id('GTBank'), toId: id('Card'), amount: 1_845_000n, date: '2026-10-29' });
    const s = await repo.load();
    const totals = periodTotals(s.events);
    expect(monthSpent(s.chart, totals, '2026-10')).toBe(2_745_000n);
    expect(categoryActivity(totals, '2026-10', id('Rent'))).toBe(600_000n);
    expect(ledgerBalance(id('Card'), s.events)).toBe(0n);
    expect(s.payees.map((p) => p.name)).toEqual(['Shoprite Lekki']);
    expect(s.payees[0]!.defaultCategoryId).toBe(id('Market'));
    expect(s.waiting.size).toBe(s.events.length);
  });

  it('delete is a reversal; undo puts the totals back', async () => {
    const { repo, id } = await setup();
    const r = await repo.addTransaction({ kind: 'income', accountId: id('GTBank'), categoryId: id('Salary'), amount: 64_000_000n, date: '2026-10-25' });
    if (!r.ok) throw new Error(r.error);
    await repo.deleteTransaction(r.value.id, '2026-10-26');
    let s = await repo.load();
    expect(s.events.find((e) => e.id === r.value.id)?.status).toBe('reversed');
    expect(monthIncome(s.chart, periodTotals(s.events), '2026-10')).toBe(0n);
    expect((await repo.deleteTransaction(r.value.id, '2026-10-26')).ok).toBe(false);
    await repo.restore(r.value);
    s = await repo.load();
    expect(monthIncome(s.chart, periodTotals(s.events), '2026-10')).toBe(64_000_000n);
  });

  it('keeps only the last 4 digits of an account number', async () => {
    const { repo } = await setup();
    const r = await repo.addAccount({ name: 'Kuda', type: 'wallet', last4: '0123456789', openingBalance: 0n, openingDate: '2026-10-01' });
    expect(r.ok && r.value.last4).toBe('6789');
  });

  it('a liability opening balance is what you owe', async () => {
    const { repo } = await setup();
    const r = await repo.addAccount({ name: 'Loan', type: 'loan', openingBalance: 84_000_000n, openingDate: '2026-10-01' });
    if (!r.ok) throw new Error();
    const s = await repo.load();
    expect(ledgerBalance(r.value.id, s.events)).toBe(-84_000_000n);
  });

  it('matches a bill to an expense already recorded, once', async () => {
    const { repo, id } = await setup();
    const tx = await repo.addTransaction({ kind: 'expense', accountId: id('GTBank'), parts: [{ categoryId: id('Rent'), amount: 10_000_000n }], date: '2026-10-05' });
    if (!tx.ok) throw new Error();
    const bill = await repo.addRecurring({ kind: 'bill', name: 'Rent', amountMinor: '10000000', accountId: id('GTBank'), categoryId: id('Rent'), rule: { every: 'month', on: 5 }, startDate: '2026-10-01' });
    const matched = await repo.matchBillToEvent(bill.id, '2026-10-05', tx.value.id);
    expect(matched.ok && matched.value).toMatchObject({ status: 'paid', amountMinor: '10000000', eventId: tx.value.id });
    expect(await repo.matchBillToEvent(bill.id, '2026-10-05', tx.value.id)).toEqual({ ok: false, error: 'already_reversed' });
  });

  it('syncs what it saved', async () => {
    const { engine, server, store } = await setup();
    await engine.sync();
    expect(await store.outbox()).toHaveLength(0);
    expect([...server.records.keys()].some((k) => k.startsWith('events:'))).toBe(true);
  });
});
