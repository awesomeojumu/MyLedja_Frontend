import { WorkspaceRepository } from '@/data/workspace/repository';
import { memorySync } from '../../../../test/helpers/render';

describe('seedHoldingBook', () => {
  it('creates holding lot and price', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
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
    const s = await repo.load();
    const inv = s.accounts.find((a) => a.type === 'investment')!;
    const r = await repo.seedHoldingBook({
      name: 'Cowrywise Halal fund',
      type: 'fund',
      accountId: inv.id,
      costMinor: 11000000n,
      valueMinor: 12000000n,
    });
    expect(r.ok).toBe(true);
    const s2 = await repo.load();
    expect(s2.holdings.map((h) => h.name)).toContain('Cowrywise Halal fund');
    expect(s2.lots.length).toBeGreaterThan(0);
    expect(s2.prices.length).toBeGreaterThan(0);
  });
});
