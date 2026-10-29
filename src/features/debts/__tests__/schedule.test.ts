import type { PersonDebt } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

import {
  debtSchedulePreview,
  debtScheduleRows,
  debtProgress,
  instalmentInterestPreview,
  reminderMessage,
  scheduleAmounts,
} from '../schedule';

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

  it('PU36-1: last instalment absorbs remainder so rows sum to total', () => {
    const amounts = scheduleAmounts(3, 10_000n);
    expect(amounts.reduce((s, a) => s + a, 0n)).toBe(10_000n);
    const rows = debtSchedulePreview({ count: 3, amountMinor: 3333n, every: 'month', firstDue: '2026-01-15', totalMinor: 10_000n });
    expect(rows.reduce((s, r) => s + r.amountMinor, 0n)).toBe(10_000n);
  });

  it('P16-06: reminder can leave the amount out', () => {
    const withAmount = reminderMessage(debt(), 5000n, { dueDate: '2026-11-15', amountMinor: 2000n, status: 'due' });
    const without = reminderMessage(debt(), 5000n, { dueDate: '2026-11-15', amountMinor: 2000n, status: 'due' }, { omitAmount: true });
    expect(withAmount).toContain('₦');
    expect(without).not.toMatch(/₦|NGN|\d{1,3}(,\d{3})+/);
  });

  it('PU-36: instalment preview includes interest when debt has terms', () => {
    expect(instalmentInterestPreview(debt({ interest: { kind: 'percent_month', percent: 2 } }), 100_000n)).toBe(2000n);
    expect(instalmentInterestPreview(debt({ interest: { kind: 'none' } }), 100_000n)).toBe(0n);
  });
});
