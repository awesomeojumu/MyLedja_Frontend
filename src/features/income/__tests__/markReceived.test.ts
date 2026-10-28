import type { IncomeStream } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

import { incomeMatchCandidates, routingConfirmRows } from '../markReceived';

function snap(events: Snapshot['events'], streams: IncomeStream[] = []): Snapshot {
  return {
    events,
    incomeStreams: streams,
    accounts: [{ id: 'bank', name: 'Bank', type: 'bank', currency: 'NGN', archived: false }],
    categories: [{ id: 'inc', name: 'Salary', kind: 'income', group: 'g', budgetType: 'flexible' }],
    goals: [{ id: 'g1', name: 'Rent', targetMinor: '100000000', accountId: 'bank', status: 'active' }],
    payees: [],
    chart: {
      get: (id: string) =>
        id === 'bank'
          ? { id, kind: 'asset' as const, currency: 'NGN' }
          : id === 'inc'
            ? { id, kind: 'income' as const, currency: 'NGN' }
            : undefined,
      system: () => undefined,
    },
  } as unknown as Snapshot;
}

describe('income mark received (#26)', () => {
  it('suggests unlinked income on the stream account', () => {
    const stream: IncomeStream = {
      id: 's1',
      name: 'Salary',
      kind: 'regular',
      expectedMinor: '64000000',
      accountId: 'bank',
      categoryId: 'inc',
      rule: { every: 'month', on: 27 },
      countInBudget: true,
    };
    const snapshot = snap(
      [
        {
          id: 'e1',
          operationId: 'e1',
          type: 'income',
          status: 'posted',
          date: '2026-10-27',
          lines: [
            { ledgerAccountId: 'bank', amountMinor: 64000000n, currency: 'NGN' },
            { ledgerAccountId: 'inc', amountMinor: -64000000n, currency: 'NGN' },
          ],
        },
      ],
      [stream],
    );
    const rows = incomeMatchCandidates(stream, snapshot, '2026-10', 64000000n);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.confidence).toBe('strong');
  });

  it('builds routing confirm rows for goals', () => {
    const stream: IncomeStream = {
      id: 's1',
      name: 'Salary',
      kind: 'regular',
      expectedMinor: '100000',
      accountId: 'bank',
      categoryId: 'inc',
      rule: { every: 'month', on: 1 },
      countInBudget: true,
      routing: [{ goalId: 'g1', amountMinor: '40000' }, { restToBudget: true }],
    };
    const snapshot = snap([], [stream]);
    const rows = routingConfirmRows(stream, snapshot, 100000n);
    expect(rows.find((r) => r.goalId === 'g1')?.amount).toBe(40000n);
    expect(rows.find((r) => r.restToBudget)?.amount).toBe(60000n);
  });
});
