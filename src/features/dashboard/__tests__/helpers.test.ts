import { WorkspaceRepository } from '@/data/workspace/repository';
import { memorySync } from '../../../../test/helpers/render';
import { checklist, comingUp } from '../helpers';

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

describe('P04-02 checklist skippedSteps', () => {
  it('persists skippedSteps and floats account / plan pickups to the top', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [],
      categories: [{ key: 'cat.rent', group: 'group.home', name: 'Rent' }],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [3, 5],
    });
    const snap = await repo.load();
    expect(snap.settings.skippedSteps).toEqual([3, 5]);
    const items = checklist(snap, false);
    expect(items[0]!.key).toBe('account');
    expect(items[0]!.fromSkip).toBe(true);
    expect(items[0]!.done).toBe(false);
    expect(items.find((i) => i.key === 'plan')!.fromSkip).toBe(true);
  });

  it('seeds a suggested first budget from monthly take-home', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [],
      categories: [
        { key: 'cat.rent', group: 'group.home', name: 'Rent' },
        { key: 'cat.fuel', group: 'group.gettingAround', name: 'Fuel' },
      ],
      budgetStyle: 'tracking',
      monthlyTakeHome: '64000000',
      skippedSteps: [],
    });
    const snap = await repo.load();
    const planned = [...snap.assigns.values()].reduce((s, a) => s + a, 0n);
    expect(planned).toBe(64000000n);
    expect(checklist(snap, false).find((i) => i.key === 'plan')!.done).toBe(true);
  });
});
