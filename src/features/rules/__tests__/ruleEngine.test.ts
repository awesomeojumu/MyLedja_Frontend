import { conditionMatches, ruleMatches } from '../ruleEngine';
import type { TransactionRule } from '@/data/workspace/model';

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

describe('ruleEngine', () => {
  it('matches payee contains', () => {
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
    };
    expect(ruleMatches(ctx, rule)).toBe(true);
    expect(conditionMatches(ctx, { field: 'amount', op: 'lessThan', value: '₦20,000.00' })).toBe(true);
  });
});
