import { applyFilters, emptyFilters, filtersFromParams } from '../filters';
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
    prices: [],
    rates: [],
    reportDashboards: [],
    savedReports: [],
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

describe('filters from the URL (P20-03)', () => {
  it('reads a month, a range and ids, and leaves out what it cannot read', () => {
    expect(filtersFromParams({ month: '2026-02', category: 'c1' })).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28', categoryId: 'c1' });
    expect(filtersFromParams({ from: '2026-10-01', to: '2026-10-31', account: 'a1', payee: 'p1' })).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      accountId: 'a1',
      payeeId: 'p1',
    });
    expect(filtersFromParams({ month: '2026-13', from: '1 Oct' })).toEqual({});
  });
});
