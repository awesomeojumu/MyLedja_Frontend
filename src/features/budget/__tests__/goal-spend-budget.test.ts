import { WorkspaceRepository } from '@/data/workspace/repository';
import { barState } from '@/ledger';

import { memorySync } from '../../../../test/helpers/render';
import { budgetForMonth, rowFor } from '../helpers';

describe('goal spend vs budget (P06-08 / E19)', () => {
  it('spending from a goal does not overspend the category and lowers left_to_plan by earmarks', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '200000000', openingDate: '2026-10-01' }],
      categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
      budgetStyle: 'envelope',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    const snap0 = await repo.load();
    const accountId = snap0.accounts[0]!.id;
    const market = snap0.categories.find((c) => c.name === 'Market')!;
    const income = snap0.categories.find((c) => c.kind === 'income')!;

    await repo.addTransaction({
      kind: 'income',
      accountId,
      categoryId: income.id,
      amount: 50_000_000n,
      date: '2026-10-02',
    });
    await repo.setAssigned(market.id, '2026-10', 5_000_000n);

    const goal = await repo.addGoal({
      name: 'Laptop',
      targetMinor: 10_000_000n,
      accountId,
      categoryId: market.id,
    });
    expect(goal.ok).toBe(true);
    if (!goal.ok) return;
    await repo.allocateToGoal(goal.value.id, { amount: 8_000_000n, date: '2026-10-05' });
    await repo.spendFromGoal(goal.value.id, {
      accountId,
      categoryId: market.id,
      amount: 3_000_000n,
      date: '2026-10-20',
    });

    const snapshot = await repo.load();
    const month = budgetForMonth(snapshot, '2026-10');
    const row = rowFor(snapshot, '2026-10', market.id);
    expect(row.activity).toBe(0n);
    expect(row.available).toBe(5_000_000n);
    expect(barState(row.activity, row.carried + row.assigned)).toBe('within');
    // left_to_plan = 50m − 5m assigned − 8m earmark = 37m
    expect(month.leftToPlan).toBe(37_000_000n);
  });
});
