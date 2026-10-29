import { MockSyncServer } from '@/api/mocks/sync';
import { holdingRows, wealthAt } from '@/features/investments/helpers';
import { ledgerBalance, monthIncome, monthSpent, periodTotals } from '@/ledger';

import { MemoryKeyValue } from '../../kv.shared';
import { LocalStore } from '../../sync/LocalStore';
import { SyncEngine } from '../../sync/SyncEngine';
import { toBackendOperation } from '../../sync/mapOperation';
import { localFromServer } from '../../sync/serverRecords';
import { WorkspaceRepository } from '../repository';

async function setup() {
  const store = new LocalStore(new MemoryKeyValue());
  const engine = new SyncEngine({ store, transport: new MockSyncServer(), deviceId: 'd' });
  const repo = new WorkspaceRepository(store, engine, 'ws');
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
  await repo.addAccount({ name: 'Stanbic Shares', type: 'investment', openingBalance: 0n, openingDate: '2026-10-01' });
  const s = await repo.load();
  const bank = s.accounts.find((a) => a.name === 'GTBank')!.id;
  const broker = s.accounts.find((a) => a.name === 'Stanbic Shares')!.id;
  const added = await repo.addHolding({ name: 'MTN Nigeria', symbol: 'MTNN', type: 'stock', accountId: broker, date: '2026-10-10' });
  if (!added.ok) throw new Error(added.error);
  return { repo, store, bank, broker, mtn: added.value.id };
}

describe('investments on the device (cases 15 to 17)', () => {
  it('buy, price and sell: cost, unrealised and realised gain; never spending', async () => {
    const { repo, store, bank, mtn } = await setup();
    const buy = await repo.buyHolding({ holdingId: mtn, accountId: bank, units: '500', price: 21000n, fees: 50000n, date: '2026-10-10' });
    expect(buy.ok).toBe(true);
    let s = await repo.load();
    expect(ledgerBalance(bank, s.events)).toBe(70_680_000n);
    expect(monthSpent(s.chart, periodTotals(s.events), '2026-10')).toBe(0n);
    expect(wealthAt(s, '2026-10-31').total).toBe(81_230_000n);

    await repo.setPrices('2026-10-20', [{ holdingId: mtn, price: 23600n }]);
    s = await repo.load();
    expect(holdingRows(s, '2026-10-31')[0]!.position).toMatchObject({ value: 11_800_000n, unrealised: 1_250_000n });
    expect(wealthAt(s, '2026-10-31').total).toBe(82_480_000n);
    expect(monthIncome(s.chart, periodTotals(s.events), '2026-10')).toBe(0n);

    const sell = await repo.sellHolding({ holdingId: mtn, accountId: bank, units: '200', price: 24000n, fees: 0n, date: '2026-10-25' });
    expect(sell.ok).toBe(true);
    s = await repo.load();
    expect(monthIncome(s.chart, periodTotals(s.events), '2026-10')).toBe(580_000n);
    expect(holdingRows(s, '2026-10-31')[0]!.position).toMatchObject({ units: 300_000_000n, cost: 6_330_000n, realised: 580_000n });

    // The sale goes to the server as the person's input; the server works out the lots again.
    const outbox = await store.outbox();
    const op = outbox.find((o) => o.type === 'event.investment_sell')!;
    const sent = toBackendOperation(op, s.accounts);
    expect(sent).toMatchObject({
      type: 'transaction.create',
      payload: { type: 'investment_sell', holdingId: mtn, accountId: bank, units: '200', price: '24000', fees: '0' },
      transactionIds: [sell.ok ? sell.value.id : ''],
    });
  });

  it('refuses selling more than held, and removing a holding with units', async () => {
    const { repo, bank, mtn } = await setup();
    expect(await repo.sellHolding({ holdingId: mtn, accountId: bank, units: '1', price: 100n, fees: 0n, date: '2026-10-25' })).toEqual({
      ok: false,
      error: 'not_enough_units',
    });
    await repo.buyHolding({ holdingId: mtn, accountId: bank, units: '1', price: 100n, fees: 0n, date: '2026-10-10' });
    expect(await repo.archiveHolding(mtn)).toEqual({ ok: false, error: 'not_enough_units' });
  });

  it('a holding is never a cash account', async () => {
    const { repo, mtn } = await setup();
    const s = await repo.load();
    const cat = s.categories.find((c) => c.kind === 'expense')!.id;
    expect(await repo.addTransaction({ kind: 'expense', accountId: mtn, parts: [{ categoryId: cat, amount: 100n }], date: '2026-10-11' })).toEqual({
      ok: false,
      error: 'wrong_account_kind',
    });
  });

  it('a reinvested dividend opens a lot and is investment income', async () => {
    const { repo, mtn } = await setup();
    const r = await repo.recordDividend({ holdingId: mtn, amount: 500_000n, reinvestedUnits: '20', date: '2026-10-12' });
    expect(r.ok).toBe(true);
    const s = await repo.load();
    expect(holdingRows(s, '2026-10-31')[0]!.position.units).toBe(20_000_000n);
    expect(monthIncome(s.chart, periodTotals(s.events), '2026-10')).toBe(500_000n);
  });

  it('exchange rates convert other currencies into net worth (case 25)', async () => {
    const { repo } = await setup();
    await repo.addAccount({ name: 'Dollar', type: 'bank', currency: 'USD', openingBalance: 12_000n, openingDate: '2026-10-01' });
    let s = await repo.load();
    expect(wealthAt(s, '2026-10-31')).toMatchObject({ total: 81_230_000n, partial: ['USD'] });
    await repo.setExchangeRate({ currency: 'USD', date: '2026-10-01', rate: '1550' });
    s = await repo.load();
    expect(wealthAt(s, '2026-10-31')).toMatchObject({ total: 81_230_000n + 18_600_000n, partial: [] });
  });
});

describe('Phase 5 records from the server', () => {
  it('reads holdings, prices, rates and investment transactions', () => {
    expect(localFromServer('holdings', 'h1', { id: 'h1', name: 'MTN', symbol: null, type: 'stock', accountId: 'a1', currency: 'NGN', archived: false, version: 2 }, 'ws')).toEqual({
      id: 'h1',
      collection: 'holdings',
      version: 2,
      data: { name: 'MTN', symbol: undefined, type: 'stock', accountId: 'a1', currency: 'NGN', archived: false },
    });
    expect(localFromServer('prices', 'p1', { holdingId: 'h1', date: '2026-10-20', price: '23600', version: 1 }, 'ws')?.data).toEqual({
      holdingId: 'h1',
      date: '2026-10-20',
      priceMinor: '23600',
    });
    const tx = localFromServer(
      'transactions',
      't1',
      {
        id: 't1',
        type: 'investment_sell',
        date: '2026-10-25',
        lines: [
          { ledgerAccountId: 'bank', accountId: 'bank', categoryId: null, system: null, amount: '4800000', currency: 'NGN' },
          { ledgerAccountId: 'h1', accountId: null, categoryId: null, system: null, amount: '-4220000', currency: 'NGN' },
          { ledgerAccountId: 'x', accountId: null, categoryId: null, system: 'investment_gain', amount: '-580000', currency: 'NGN' },
        ],
        links: { holdingId: 'h1' },
        investment: { kind: 'sell', units: '200', price: '24000', fees: '0', lots: [{ lotId: 'b1', units: '200', cost: '4220000' }] },
      },
      'ws',
    );
    expect(tx?.data).toMatchObject({
      holdingId: 'h1',
      lines: [
        { a: 'bank', m: '4800000' },
        { a: 'h1', m: '-4220000' },
        { a: 'ws:investment_gain', m: '-580000' },
      ],
      investment: { kind: 'sell', lots: [{ lotId: 'b1', units: '200', cost: '4220000' }] },
    });
  });
});
