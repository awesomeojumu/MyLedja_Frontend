import { planSummaryStrip, billsForMonth } from '../recurrence';
import type { Snapshot } from '@/data/workspace/repository';

function stubSnapshot(): Snapshot {
  return {
    workspaceId: 'ws',
    settings: { budgetStyle: 'tracking', currency: 'NGN', weekStart: 'monday' },
    accounts: [],
    categories: [],
    payees: [],
    events: [],
    reconciles: [],
    assigns: new Map(),
    assignNotes: new Map(),
    goals: [],
    allocations: [],
    recurring: [
      {
        id: 'r1',
        kind: 'bill',
        name: 'Rent',
        amountMinor: '100000',
        accountId: 'a1',
        categoryId: 'c1',
        rule: { every: 'month', on: 5 },
        startDate: '2026-10-01',
      },
    ],
    occurrences: [],
    incomeStreams: [{ id: 'i1', name: 'Salary', kind: 'regular', expectedMinor: '500000', accountId: 'a1', categoryId: 'c2', rule: { every: 'month', on: 27 }, countInBudget: true }],
    debts: [],
    debtEntries: [],
    notifications: [],
    budgetTemplates: [],
    rules: [],
    holdings: [],
    prices: [],
    rates: [],
    reportDashboards: [],
    savedReports: [],
    waiting: new Set(),
    chart: {} as unknown as Snapshot['chart'],
  };
}

describe('planSummaryStrip (DESIGN page 12)', () => {
  it('computes coming in, going out, left after, missed', () => {
    const s = stubSnapshot();
    const rows = billsForMonth(s, '2026-10', '2026-10-28', 7);
    const strip = planSummaryStrip(s, '2026-10', rows);
    expect(strip.comingIn).toBe(500000n);
    expect(strip.goingOut).toBe(100000n);
    expect(strip.leftAfter).toBe(400000n);
  });
});
