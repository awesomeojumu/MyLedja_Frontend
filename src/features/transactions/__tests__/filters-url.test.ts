import { applyDatePreset, applyFilters, clearFilterParams, emptyFilters, filterChips, filtersFromParams, filtersToParams, removeChip } from '../filters';
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
        correctionOf: 'e0',
        notes: 'tags:weekend\nreceipt:https://example.com/r.jpg?exp=9999999999',
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

describe('PU-19 / TB-13 filter URL + chips', () => {
  it('PU19-2: filters round-trip through URL params', () => {
    const filters = {
      ...emptyFilters(),
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      categoryId: 'c1',
      type: 'expense' as const,
      edited: true,
      hasReceipt: true,
      tag: 'weekend',
    };
    const params = filtersToParams(filters);
    expect(params).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      category: 'c1',
      type: 'expense',
      edited: '1',
      hasReceipt: '1',
      tag: 'weekend',
    });
    expect(filtersFromParams(params)).toEqual(filters);
    expect(Object.keys(clearFilterParams()).length).toBeGreaterThan(5);
  });

  it('TB13-1: removing one chip removes only that filter', () => {
    const snapshot = snapshotStub();
    const filters = { dateFrom: '2026-10-01', dateTo: '2026-10-31', categoryId: 'c1', type: 'expense' as const };
    const chips = filterChips(filters, snapshot);
    expect(chips.length).toBe(3);
    const withoutType = removeChip(filters, 'type');
    expect(withoutType.type).toBeUndefined();
    expect(withoutType.categoryId).toBe('c1');
    expect(withoutType.dateFrom).toBe('2026-10-01');
  });

  it('PU19-1: date presets and edited / receipt / tag filters match rows', () => {
    const snapshot = snapshotStub();
    const rows = rowsFor(snapshot);
    const range = applyDatePreset('thisMonth', '2026-10-29');
    expect(range.dateFrom).toBe('2026-10-01');
    const edited = rows.filter((r) => applyFilters(r, { edited: true }, snapshot));
    expect(edited.map((r) => r.event.id)).toEqual(['e1']);
    const tagged = rows.filter((r) => applyFilters(r, { tag: 'weekend' }, snapshot));
    expect(tagged).toHaveLength(1);
    const withReceipt = rows.filter((r) => applyFilters(r, { hasReceipt: true }, snapshot));
    expect(withReceipt).toHaveLength(1);
  });
});
