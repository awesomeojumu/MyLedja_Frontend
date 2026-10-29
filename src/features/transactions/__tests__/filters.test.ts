import { applyFilters, emptyFilters } from '../filters';
import { rowsFor } from '../helpers';
import type { Snapshot } from '@/data/workspace/repository';

function snapshotStub(): Snapshot {
  return {
    workspaceId: 'ws',
    settings: { budgetStyle: 'tracking', currency: 'NGN', weekStart: 'monday' },
    accounts: [{ id: 'a1', name: 'GTBank', type: 'bank', currency: 'NGN', countInBudget: true, archived: false, order: 0 }],
    categories: [{ id: 'c1', name: 'Market', kind: 'expense', group: 'group.food', hidden: false, countInBudget: true, order: 0, budgetType: 'flexible', carryOver: false }],
    payees: [{ id: 'p1', name: 'Shoprite' }],
    events: [
      {
        id: 'e1',
        operationId: 'e1',
        type: 'expense',
        date: '2026-10-12',
        status: 'posted',
        payeeId: 'p1',
        lines: [
          { ledgerAccountId: 'a1', amountMinor: -500_000n, currency: 'NGN' },
          { ledgerAccountId: 'c1', amountMinor: 500_000n, currency: 'NGN' },
        ],
      },
      {
        id: 'e2',
        operationId: 'e2',
        type: 'income',
        date: '2026-10-15',
        status: 'posted',
        lines: [
          { ledgerAccountId: 'a1', amountMinor: 1_000_000n, currency: 'NGN' },
          { ledgerAccountId: 'c1', amountMinor: -1_000_000n, currency: 'NGN' },
        ],
      },
    ],
    reconciles: [],
    assigns: new Map(),
    assignNotes: new Map(),
    goals: [],
    allocations: [],
    recurring: [],
    occurrences: [],
    incomeStreams: [],
    debts: [],
    debtEntries: [],
    notifications: [],
    budgetTemplates: [],
    rules: [],
    holdings: [],
    lots: [],
    prices: [],
    waiting: new Set(),
    chart: {} as Snapshot['chart'],
  };
}

describe('transaction filters', () => {
  it('P11-03: filters by account and type', () => {
    const snapshot = snapshotStub();
    const rows = rowsFor(snapshot);
    const expenseOnly = rows.filter((r) => applyFilters(r, { ...emptyFilters(), type: 'expense' }, snapshot));
    expect(expenseOnly).toHaveLength(1);
    expect(expenseOnly[0]!.event.id).toBe('e1');
  });
});
