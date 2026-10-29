import { applyFilters } from '../filters';
import { rowsFor } from '../helpers';
import type { Snapshot } from '@/data/workspace/repository';

describe('tx filters hasReceipt', () => {
  it('filters rows with receipt notes', () => {
    const snapshot = {
      workspaceId: 'ws',
      settings: { budgetStyle: 'tracking', currency: 'NGN', weekStart: 'monday' },
      accounts: [{ id: 'a1', name: 'Bank', type: 'bank', currency: 'NGN', countInBudget: true, archived: false, order: 0 }],
      categories: [{ id: 'c1', name: 'Food', kind: 'expense', group: 'g', hidden: false, countInBudget: true, order: 0, budgetType: 'flexible', carryOver: false }],
      payees: [],
      events: [
        {
          id: 'e1',
          operationId: 'e1',
          type: 'expense',
          date: '2026-10-01',
          status: 'posted',
          notes: 'receipt:https://example.com/r1',
          lines: [
            { ledgerAccountId: 'a1', amountMinor: -100n, currency: 'NGN' },
            { ledgerAccountId: 'c1', amountMinor: 100n, currency: 'NGN' },
          ],
        },
        {
          id: 'e2',
          operationId: 'e2',
          type: 'expense',
          date: '2026-10-02',
          status: 'posted',
          lines: [
            { ledgerAccountId: 'a1', amountMinor: -200n, currency: 'NGN' },
            { ledgerAccountId: 'c1', amountMinor: 200n, currency: 'NGN' },
          ],
        },
      ],
      reconciles: [],
      assigns: new Map(),
      assignNotes: new Map(),
      budgetTemplates: [],
      rules: [],
      goals: [],
      allocations: [],
      recurring: [],
      occurrences: [],
      incomeStreams: [],
      debts: [],
      debtEntries: [],
      notifications: [],
      holdings: [],
      lots: [],
      prices: [],
      reportDashboards: [],
      savedReports: [],
      waiting: new Set(),
      chart: {} as Snapshot['chart'],
    } satisfies Snapshot;
    const rows = rowsFor(snapshot).filter((r) => applyFilters(r, { hasReceipt: true }, snapshot));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.event.id).toBe('e1');
    expect(applyFilters(rowsFor(snapshot)[1]!, { hasReceipt: true }, snapshot)).toBe(false);
  });
});
