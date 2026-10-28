import type { TransactionRule } from '@/data/workspace/model';

import { ruleChangeFor } from '../ruleEngine';

const rule = (over: Partial<TransactionRule>): TransactionRule => ({
  id: 'r',
  enabled: true,
  stage: 'normal',
  order: 0,
  matchMode: 'all',
  conditions: [{ field: 'payee', op: 'contains', value: 'bolt' }],
  actions: [{ kind: 'setCategory', value: 'cat-transport' }],
  matchedCount: 0,
  ...over,
});
const input = { payeeName: 'BOLT LAGOS', description: 'BOLT LAGOS', amountMinor: 350_000n, accountId: 'a', categoryId: '', notes: '', date: '2026-10-12' };

describe('rules on new and imported transactions (P25-05)', () => {
  it('sets the category, renames the payee and adds notes', () => {
    const rules = [
      rule({}),
      rule({ id: 'r2', actions: [{ kind: 'renamePayee', value: 'Ride' }, { kind: 'addNote', value: 'Work trip' }] }),
    ];
    expect(ruleChangeFor(rules, input)).toEqual({ categoryId: 'cat-transport', payeeName: 'Ride', notes: 'Work trip' });
  });

  it('skips disabled and deleted rules; the last stage wins', () => {
    const deleted = { ...rule({ id: 'd', actions: [{ kind: 'setCategory', value: 'cat-x' }] }), deleted: true } as TransactionRule;
    expect(ruleChangeFor([rule({ enabled: false }), deleted], input)).toEqual({});
    expect(ruleChangeFor([rule({ stage: 'last', actions: [{ kind: 'setCategory', value: 'cat-last' }] }), rule({ stage: 'first' })], input).categoryId).toBe('cat-last');
  });
});
