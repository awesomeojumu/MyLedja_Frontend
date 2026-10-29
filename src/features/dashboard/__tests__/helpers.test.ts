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
