import { WorkspaceRepository } from '@/data/workspace/repository';

import { memorySync } from '../../../../test/helpers/render';
import { defaultBuilderName, EMPTY_SPEC, rangeFor, runBuilderPreview } from '../builderRunner';

describe('builderRunner', () => {
  it('runs a custom spending-by-category preview', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'Cash', type: 'cash', openingBalance: '0', openingDate: '2026-10-01' }],
      categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    const snapshot = await repo.load();
    const accountId = snapshot.accounts[0]!.id;
    const marketId = snapshot.categories.find((c) => c.name === 'Market')!.id;
    await repo.addTransaction({
      kind: 'expense',
      accountId,
      parts: [{ categoryId: marketId, amount: 500_000n }],
      date: '2026-10-12',
      payeeName: 'Shop',
    });
    const after = await repo.load();
    const result = runBuilderPreview(after, EMPTY_SPEC, { from: '2026-10-01', to: '2026-10-31' });
    expect(result.chart).toBe('bar');
    expect(result.unit).toBe('money');
    expect(result.table.total).toBeGreaterThan(0n);
  });

  it('rangeFor covers TB-14 presets', () => {
    expect(rangeFor('this_month', '2026-10-28', null)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(rangeFor('this_year', '2026-10-28', null).from).toBe('2026-01-01');
    expect(defaultBuilderName(EMPTY_SPEC, 'This month')).toContain('Spending');
  });
});
