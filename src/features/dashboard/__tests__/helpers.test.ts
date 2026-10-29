import { WorkspaceRepository } from '@/data/workspace/repository';
import { memorySync } from '../../../../test/helpers/render';
import { comingUp, cumulativeSpendingByDay, dashboardModel } from '../helpers';

describe('dashboard coming up', () => {
  it('P05-10: overdue bills sort before upcoming within 14 days', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
      categories: [{ key: 'cat.rent', group: 'group.home', name: 'Rent' }],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    const s = await repo.load();
    await repo.addRecurring({
      kind: 'bill',
      name: 'Rent',
      amountMinor: '12000000',
      accountId: s.accounts[0]!.id,
      categoryId: s.categories[0]!.id,
      rule: { every: 'month', on: 5 },
      startDate: '2026-10-01',
    });
    await repo.addRecurring({
      kind: 'bill',
      name: 'Internet',
      amountMinor: '2000000',
      accountId: s.accounts[0]!.id,
      categoryId: s.categories[0]!.id,
      rule: { every: 'month', on: 30 },
      startDate: '2026-10-01',
    });
    const snap = await repo.load();
    const rows = comingUp(snap, '2026-10-28', 14);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]!.overdue).toBe(true);
    expect(rows[0]!.recurring.name).toBe('Rent');
    jest.useRealTimers();
  });

  it('P05-10: includes expected income streams in the 14-day window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
      categories: [{ key: 'cat.rent', group: 'group.home', name: 'Rent' }],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    const s = await repo.load();
    const incomeCat = s.categories.find((c) => c.kind === 'income')!;
    await repo.addIncomeStream({
      name: 'Salary',
      kind: 'regular',
      expectedMinor: '64000000',
      accountId: s.accounts[0]!.id,
      categoryId: incomeCat.id,
      rule: { every: 'month', on: 27 },
      countInBudget: true,
    });
    const snap = await repo.load();
    const rows = comingUp(snap, '2026-10-20', 14);
    expect(rows.some((r) => r.recurring.name === 'Salary' && r.recurring.kind === 'income')).toBe(true);
    jest.useRealTimers();
  });

  it('D14: where-it-went keeps top 6 groups plus Other', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '500000000', openingDate: '2026-10-01' }],
      categories: [
        { key: 'cat.a', group: 'group.food', name: 'A' },
        { key: 'cat.b', group: 'group.transport', name: 'B' },
        { key: 'cat.c', group: 'group.home', name: 'C' },
        { key: 'cat.d', group: 'group.bills', name: 'D' },
        { key: 'cat.e', group: 'group.fun', name: 'E' },
        { key: 'cat.f', group: 'group.health', name: 'F' },
        { key: 'cat.g', group: 'group.other', name: 'G' },
      ],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    const s = await repo.load();
    const accountId = s.accounts[0]!.id;
    const byName = (name: string) => s.categories.find((c) => c.name === name)!.id;
    const spends: [string, bigint][] = [
      ['A', 70_000_000n],
      ['B', 60_000_000n],
      ['C', 50_000_000n],
      ['D', 40_000_000n],
      ['E', 30_000_000n],
      ['F', 20_000_000n],
      ['G', 10_000_000n],
    ];
    for (const [name, amount] of spends) {
      await repo.addTransaction({
        kind: 'expense',
        accountId,
        parts: [{ categoryId: byName(name), amount }],
        date: '2026-10-12',
      });
    }
    const snap = await repo.load();
    const model = dashboardModel(snap, '2026-10');
    expect(model.where).toHaveLength(7);
    expect(model.where[model.where.length - 1]!.label.toLowerCase()).toContain('other');
    expect(model.where[model.where.length - 1]!.value).toBe(10_000_000n);
    jest.useRealTimers();
  });

  it('D11: cumulative spending by day grows for this month', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
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
    await repo.addTransaction({
      kind: 'expense',
      accountId: s.accounts[0]!.id,
      parts: [{ categoryId: s.categories.find((c) => c.name === 'Market')!.id, amount: 5_000_000n }],
      date: '2026-10-10',
    });
    const snap = await repo.load();
    const days = cumulativeSpendingByDay(snap, '2026-10');
    expect(days).toHaveLength(31);
    expect(days[8]!.thisMonth).toBe(0n);
    expect(days[9]!.thisMonth).toBe(5_000_000n);
    expect(days[30]!.thisMonth).toBe(5_000_000n);
    const model = dashboardModel(snap, '2026-10');
    expect(model.spendingTrendRows[9]!.value).toBe(5_000_000n);
    expect(model.spendingTrendCompare).toHaveLength(31);
    jest.useRealTimers();
  });
});
