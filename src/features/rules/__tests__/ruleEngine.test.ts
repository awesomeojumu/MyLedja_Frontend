import type { TransactionRule } from '@/data/workspace/model';

import {
  conditionMatches,
  countReconciledSkipped,
  matchWouldChange,
  parseSplitValue,
  previewMatches,
  ruleMatches,
  splitTotalsOk,
} from '../ruleEngine';

const rule: TransactionRule = {
  id: 'r1',
  enabled: true,
  stage: 'normal',
  order: 0,
  matchMode: 'all',
  matchedCount: 0,
  conditions: [{ field: 'payee', op: 'contains', value: 'Bolt' }],
  actions: [{ kind: 'setCategory', value: 'cat-transport' }],
};

const ctx = {
  eventId: 'e1',
  payeeName: 'Bolt Trip',
  description: '',
  amountMinor: 850000n,
  accountId: 'acc',
  categoryId: 'food',
  notes: '',
  date: '2026-10-28',
  type: 'expense',
  reconciled: false,
};

describe('ruleEngine', () => {
  it('matches payee contains', () => {
    expect(ruleMatches(ctx, rule)).toBe(true);
    expect(conditionMatches(ctx, { field: 'amount', op: 'lessThan', value: '₦20,000.00' })).toBe(true);
  });

  it('matches money out and day of month (PU-48)', () => {
    expect(conditionMatches(ctx, { field: 'money', op: 'isOut', value: '' })).toBe(true);
    expect(conditionMatches(ctx, { field: 'date', op: 'dayOfMonth', value: '28' })).toBe(true);
  });

  it('split totals 100% (PU48-2)', () => {
    const split = parseSplitValue('pct:cat-a=60|cat-b=40');
    expect(split).toBeTruthy();
    expect(splitTotalsOk(split!, 850000n)).toBe(true);
    expect(splitTotalsOk(parseSplitValue('pct:cat-a=40|cat-b=40')!, 850000n)).toBe(false);
  });

  it('matchWouldChange ignores no-ops and reconciled', () => {
    expect(matchWouldChange(ctx, rule.actions)).toBe(true);
    expect(matchWouldChange({ ...ctx, categoryId: 'cat-transport' }, rule.actions)).toBe(false);
    expect(matchWouldChange({ ...ctx, reconciled: true }, rule.actions)).toBe(false);
  });

  it('previewMatches skips reconciled and can count only changing (PU49-1)', () => {
    const snapshot = {
      accounts: [{ id: 'acc' }],
      categories: [{ id: 'food' }, { id: 'cat-transport' }],
      payees: [{ id: 'p1', name: 'Bolt Trip' }],
      events: [
        {
          id: 'e1',
          status: 'posted',
          type: 'expense',
          date: '2026-10-28',
          payeeId: 'p1',
          notes: '',
          lines: [
            { ledgerAccountId: 'acc', amountMinor: -850000n },
            { ledgerAccountId: 'food', amountMinor: 850000n },
          ],
        },
        {
          id: 'e2',
          status: 'posted',
          type: 'expense',
          date: '2026-10-27',
          payeeId: 'p1',
          notes: '',
          reconciledBy: 'rec1',
          lines: [
            { ledgerAccountId: 'acc', amountMinor: -100000n },
            { ledgerAccountId: 'food', amountMinor: 100000n },
          ],
        },
      ],
    } as unknown as import('@/data/workspace/repository').Snapshot;

    expect(previewMatches(snapshot, rule).map((m) => m.eventId)).toEqual(['e1']);
    expect(countReconciledSkipped(snapshot, rule)).toBe(1);
    expect(previewMatches(snapshot, rule, undefined, undefined, { onlyChanging: true })).toHaveLength(1);
  });
});
