import type { IncomeStream } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

import { grossSplitParts } from '../grossSplit';
import { streamDueDateInMonth, streamPaymentDots, taxTotalsForYear } from '../helpers';

function baseStream(over: Partial<IncomeStream> = {}): IncomeStream {
  return {
    id: 's1',
    name: 'Salary',
    kind: 'regular',
    expectedMinor: '62000000',
    accountId: 'bank',
    categoryId: 'salary',
    rule: { every: 'month', on: 27 },
    countInBudget: true,
    ...over,
  };
}

function snap(events: Snapshot['events'], streams: IncomeStream[]): Snapshot {
  return {
    events,
    incomeStreams: streams,
    accounts: [],
    categories: [],
    goals: [],
    payees: [],
    chart: {
      get: (id: string) =>
        id === 'bank'
          ? { id, kind: 'asset' as const, currency: 'NGN' }
          : id === 'salary'
            ? { id, kind: 'income' as const, currency: 'NGN' }
            : id === 'pension' || id === 'nhf'
              ? { id, kind: 'asset' as const, currency: 'NGN' }
              : id.includes('taxes')
                ? { id, kind: 'expense' as const, currency: 'NGN' }
                : undefined,
      system: () => undefined,
    },
  } as unknown as Snapshot;
}

describe('income helpers (P13)', () => {
  it('P13-02: full receipt after due day is late', () => {
    const stream = baseStream();
    const snapshot = snap(
      [
        {
          id: 'e1',
          operationId: 'e1',
          type: 'income',
          status: 'posted',
          date: '2026-10-29',
          incomeStreamId: 's1',
          lines: [
            { ledgerAccountId: 'bank', amountMinor: 62000000n, currency: 'NGN' },
            { ledgerAccountId: 'salary', amountMinor: -62000000n, currency: 'NGN' },
          ],
        },
      ],
      [stream],
    );
    expect(streamDueDateInMonth(stream, '2026-10')).toBe('2026-10-27');
    const dots = streamPaymentDots(stream, snapshot, '2026-10');
    expect(dots[dots.length - 1]).toBe('late');
  });

  it('P13-08: gross YTD counts once per month for take-home links', () => {
    const stream = baseStream({
      recordMode: 'gross',
      grossMinor: '80000000',
      taxClass: 'PAYE',
    });
    const snapshot = snap(
      [
        {
          id: 'e1',
          operationId: 'e1',
          type: 'income',
          status: 'posted',
          date: '2026-10-10',
          incomeStreamId: 's1',
          lines: [
            { ledgerAccountId: 'bank', amountMinor: 30000000n, currency: 'NGN' },
            { ledgerAccountId: 'salary', amountMinor: -30000000n, currency: 'NGN' },
          ],
        },
        {
          id: 'e2',
          operationId: 'e2',
          type: 'income',
          status: 'posted',
          date: '2026-10-20',
          incomeStreamId: 's1',
          lines: [
            { ledgerAccountId: 'bank', amountMinor: 32000000n, currency: 'NGN' },
            { ledgerAccountId: 'salary', amountMinor: -32000000n, currency: 'NGN' },
          ],
        },
      ],
      [stream],
    );
    const rows = taxTotalsForYear(snapshot, '2026');
    expect(rows.find((r) => r.label === 'PAYE')?.gross).toBe(80000000n);
  });

  it('E24 gross split parts for case 18', () => {
    const parts = grossSplitParts(
      baseStream({
        recordMode: 'gross',
        grossMinor: '80000000',
        deductions: [
          { kind: 'paye', amountMinor: '9600000' },
          { kind: 'pension', amountMinor: '6400000', targetAccountId: 'pension' },
          { kind: 'nhf', amountMinor: '2000000', targetAccountId: 'nhf' },
        ],
      }),
    );
    expect(parts).toEqual({
      gross: 80000000n,
      takeHome: 62000000n,
      paye: 9600000n,
      pension: 6400000n,
      nhf: 2000000n,
      pensionAccountId: 'pension',
      nhfAccountId: 'nhf',
    });
  });
});
