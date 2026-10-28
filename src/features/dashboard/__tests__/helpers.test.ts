import { WorkspaceRepository } from '@/data/workspace/repository';
import { memorySync } from '../../../../test/helpers/render';
import { comingUp } from '../helpers';

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
});
