import type { PersonDebt } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

import { debtSchedulePreview, debtScheduleRows, debtProgress } from '../schedule';

function debt(over: Partial<PersonDebt> = {}): PersonDebt {
  return {
    id: 'd1',
    name: 'Tunde',
    direction: 'owedToMe',
    ledgerAccountId: 'acc:d1',
    status: 'open',
    scheduleInstallmentCount: 3,
    scheduleAmountMinor: '2000000',
    scheduleEvery: 'month',
    scheduleFirstDue: '2026-11-15',
    ...over,
  };
}

const snapshot = {
  debtEntries: [{ id: 'e1', debtId: 'd1', date: '2026-11-15', eventId: 'ev1', kind: 'payment' as const, amountMinor: '2000000' }],
} as unknown as Snapshot;

describe('debt schedule (P16-04)', () => {
  it('builds preview instalments', () => {
    const rows = debtSchedulePreview({ count: 2, amountMinor: 1000n, every: 'month', firstDue: '2026-01-15' });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.dueDate).toBe('2026-01-15');
    expect(rows[1]?.dueDate).toBe('2026-02-15');
  });

  it('marks paid instalments', () => {
    const rows = debtScheduleRows(debt(), snapshot, '2026-11-20');
    expect(rows[0]?.status).toBe('paid');
    expect(rows[1]?.status).toBe('upcoming');
  });

  it('computes progress from balance', () => {
    const prog = debtProgress('d1', { debtEntries: [{ debtId: 'd1', kind: 'lend', amountMinor: '10000' }] } as unknown as Snapshot, 4000n);
    expect(prog).toBeCloseTo(0.6);
  });
});
