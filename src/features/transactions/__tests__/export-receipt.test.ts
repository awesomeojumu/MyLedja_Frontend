import { exportTransactionsCsvFiltered } from '../exportCsv';
import { resolveReceiptUrl } from '../receiptMeta';
import { parseTags, withTags } from '../tags';
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
        notes: 'tags:food\n=SUM(A1)',
        lines: [
          { ledgerAccountId: 'a1', amountMinor: -1_845_000n, currency: 'NGN' },
          { ledgerAccountId: 'c1', amountMinor: 1_845_000n, currency: 'NGN' },
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
    reportDashboards: [],
    savedReports: [],
    waiting: new Set(),
    chart: {} as Snapshot['chart'],
  };
}

describe('PU-24 export + PU-23 receipt link', () => {
  it('PU24-1 / PU24-2: amounts use brackets and formulas are escaped', () => {
    const csv = exportTransactionsCsvFiltered(snapshotStub(), { safeFormulas: true });
    expect(csv).toContain('(₦18450.00)');
    expect(csv).toContain("'=SUM(A1)");
  });

  it('PU23-1: expired signed receipt links resolve to nothing', () => {
    expect(resolveReceiptUrl('https://cdn.example/r.jpg?exp=1', 100)).toBeNull();
    expect(resolveReceiptUrl('https://cdn.example/r.jpg?exp=999', 100)).toBe('https://cdn.example/r.jpg?exp=999');
  });

  it('tags round-trip in notes', () => {
    expect(parseTags(withTags('hello', ['a', 'b']))).toEqual(['a', 'b']);
  });
});
