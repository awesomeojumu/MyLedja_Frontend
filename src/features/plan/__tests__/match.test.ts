import type { Snapshot } from '@/data/workspace/repository';

import { billMatchCandidates } from '../match';
import { billsForMonth } from '../recurrence';

function stub(): Snapshot {
  return {
    workspaceId: 'ws',
    settings: { budgetStyle: 'tracking', currency: 'NGN', weekStart: 'monday' },
    accounts: [{ id: 'a1', name: 'Bank', type: 'bank', currency: 'NGN', order: 0, archived: false, countInBudget: true }],
    categories: [{ id: 'c1', name: 'Food', kind: 'expense', group: 'g', order: 0, hidden: false, countInBudget: true, budgetType: 'flexible', carryOver: false }],
    payees: [],
    events: [
      {
        id: 'e1',
        operationId: 'e1',
        type: 'expense',
        date: '2026-10-05',
        status: 'posted',
        lines: [
          { ledgerAccountId: 'a1', amountMinor: -100000n, currency: 'NGN' },
          { ledgerAccountId: 'c1', amountMinor: 100000n, currency: 'NGN' },
        ],
      },
    ],
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
    incomeStreams: [],
    debts: [],
    debtEntries: [],
    notifications: [],
    budgetTemplates: [],
    rules: [],
    waiting: new Set(),
    chart: {} as Snapshot['chart'],
  };
}

describe('billMatchCandidates (#26)', () => {
  it('suggests nearby expenses with similar amount', () => {
    const s = stub();
    const rows = billsForMonth(s, '2026-10', '2026-10-28', 7);
    const row = rows[0]!;
    const candidates = billMatchCandidates(s, row);
    expect(candidates.some((c) => c.eventId === 'e1')).toBe(true);
  });
});
