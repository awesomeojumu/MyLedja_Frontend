import { ledgerBalance } from '@/ledger';
import { WorkspaceRepository } from '@/data/workspace/repository';

import { MemoryKeyValue } from '../../../data/kv.shared';
import { LocalStore } from '../../../data/sync/LocalStore';
import { SyncEngine } from '../../../data/sync/SyncEngine';
import { MockSyncServer } from '@/api/mocks/sync';

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
      { name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' },
      { name: 'Brokerage', type: 'investment', openingBalance: '0', openingDate: '2026-10-01' },
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return repo;
}

describe('holdings repository (PU-37…40)', () => {
  it('PU37-1: adding a holding changes no balance', async () => {
    const repo = await setup();
    const before = await repo.load();
    const cash = before.accounts.find((a) => a.type === 'bank')!;
    const inv = before.accounts.find((a) => a.type === 'investment')!;
    const balBefore = ledgerBalance(cash.id, before.events);
    const created = await repo.createHolding({ name: 'MTN', type: 'stock', accountId: inv.id });
    expect(created.ok).toBe(true);
    const after = await repo.load();
    expect(ledgerBalance(cash.id, after.events)).toBe(balBefore);
    expect(after.holdings).toHaveLength(1);
  });

  it('PU38-1 / PU38-3: buy then refuse oversell', async () => {
    const repo = await setup();
    const snap = await repo.load();
    const cash = snap.accounts.find((a) => a.type === 'bank')!;
    const inv = snap.accounts.find((a) => a.type === 'investment')!;
    const h = await repo.createHolding({ name: 'MTN', type: 'stock', accountId: inv.id });
    if (!h.ok) throw new Error('holding');
    const buy = await repo.buyHolding({
      holdingId: h.value.id,
      units: '500',
      pricePerUnit: 21000n,
      fees: 50000n,
      cashAccountId: cash.id,
      date: '2026-10-28',
    });
    expect(buy.ok).toBe(true);
    const after = await repo.load();
    expect(ledgerBalance(h.value.ledgerAccountId, after.events)).toBe(10550000n);
    const oversell = await repo.sellHolding({
      holdingId: h.value.id,
      units: '600',
      pricePerUnit: 24000n,
      cashAccountId: cash.id,
      date: '2026-10-29',
    });
    expect(oversell.ok).toBe(false);
  });

  it('PU40-1: empty price rows keep old price', async () => {
    const repo = await setup();
    const snap = await repo.load();
    const inv = snap.accounts.find((a) => a.type === 'investment')!;
    const h = await repo.createHolding({ name: 'MTN', type: 'stock', accountId: inv.id, currentPriceMinor: 21000n });
    if (!h.ok) throw new Error('holding');
    await repo.savePrices([], '2026-10-29');
    const after = await repo.load();
    expect(after.prices.filter((p) => p.holdingId === h.value.id)).toHaveLength(1);
    expect(after.prices[0]!.priceMinor).toBe('21000');
  });
});
