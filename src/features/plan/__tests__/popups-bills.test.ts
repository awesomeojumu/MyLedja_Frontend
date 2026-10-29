import type { Snapshot } from '@/data/workspace/repository';

import { billMatchCandidates } from '../match';
import {
  allScheduleRows,
  billsForMonth,
  dayListTitle,
  findRecurringSuggestions,
  occurrenceDates,
  planRowsForMonth,
  rowsByDate,
  scheduleCreatesReminders,
  withinEndAfterCount,
} from '../recurrence';
import { defaultCountInBudget, deductionsExceedGross, routingExceedsIncome } from '../../income/helpers';

function stubSnapshot(partial: Partial<Snapshot> = {}): Snapshot {
  return {
    workspaceId: 'ws',
    settings: { budgetStyle: 'tracking', currency: 'NGN', weekStart: 'monday', ...(partial.settings ?? {}) },
    accounts: [{ id: 'a1', name: 'Bank', type: 'bank', currency: 'NGN', order: 0, archived: false, countInBudget: true }],
    categories: [{ id: 'c1', name: 'Rent', kind: 'expense', group: 'g', order: 0, hidden: false, countInBudget: true, budgetType: 'flexible', carryOver: false }],
    payees: [{ id: 'p1', name: 'Landlord' }],
    events: [],
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
    ...partial,
  };
}

describe('PU-25 recurrence', () => {
  it('PU25-1: bill on the 31st falls on 30 November and 28 February', () => {
    expect(occurrenceDates({ every: 'month', on: 31 }, '2026-01-31', 3)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(occurrenceDates({ every: 'month', on: 31 }, '2026-10-31', 2)[1]).toBe('2026-11-30');
  });

  it('PU25-2: After 6 times stops after the sixth occurrence', () => {
    const dates = occurrenceDates({ every: 'month', on: 1 }, '2026-01-01', 6);
    expect(dates).toHaveLength(6);
    expect(dates[5]).toBe('2026-06-01');
    const recurring = {
      id: 'r1',
      kind: 'bill' as const,
      name: 'Gym',
      amountMinor: '10000',
      accountId: 'a1',
      rule: { every: 'month' as const, on: 1 },
      startDate: '2026-01-01',
      endAfterCount: 6,
      endDate: '2026-06-01',
    };
    expect(withinEndAfterCount(recurring, '2026-06-01')).toBe(true);
    expect(withinEndAfterCount(recurring, '2026-07-01')).toBe(false);
  });

  it('PU25-3: hideAmountOnLock defaults on; reminders off when undefined', () => {
    expect(scheduleCreatesReminders({ id: '1', kind: 'bill', name: 'x', amountMinor: '1', accountId: 'a', rule: { every: 'month', on: 1 }, startDate: '2026-01-01', reminderDays: 1 })).toBe(true);
    expect(scheduleCreatesReminders({ id: '1', kind: 'bill', name: 'x', amountMinor: '1', accountId: 'a', rule: { every: 'month', on: 1 }, startDate: '2026-01-01' })).toBe(false);
    expect(scheduleCreatesReminders({ id: '1', kind: 'bill', name: 'x', amountMinor: '1', accountId: 'a', rule: { every: 'month', on: 1 }, startDate: '2026-01-01', reminderDays: 1, paused: true })).toBe(false);
  });
});

describe('PU-26 / PU-27 / PU-28 / PU-59 / TB-04', () => {
  it('PU26-1: candidates skip events already linked to an occurrence', () => {
    const s = stubSnapshot({
      events: [
        {
          id: 'e1',
          operationId: 'e1',
          type: 'expense',
          date: '2026-10-05',
          status: 'posted',
          lines: [
            { ledgerAccountId: 'a1', amountMinor: -100000n, currency: 'NGN' },
            { ledgerAccountId: 'c1', amountMinor: 100000n, currency: 'NGN' },
          ],
        },
      ],
      recurring: [
        { id: 'r1', kind: 'bill', name: 'Rent', amountMinor: '100000', accountId: 'a1', categoryId: 'c1', rule: { every: 'month', on: 5 }, startDate: '2026-09-01' },
        { id: 'r2', kind: 'bill', name: 'Other', amountMinor: '100000', accountId: 'a1', categoryId: 'c1', rule: { every: 'month', on: 5 }, startDate: '2026-09-01' },
      ],
      occurrences: [{ id: 'r1:2026-09-05', recurringId: 'r1', dueDate: '2026-09-05', amountMinor: '100000', status: 'paid', eventId: 'e1' }],
    });
    const rows = billsForMonth(s, '2026-10', '2026-10-28', 7);
    const other = rows.find((r) => r.recurring.id === 'r2')!;
    expect(billMatchCandidates(s, other).some((c) => c.eventId === 'e1')).toBe(false);
  });

  it('PU27-1: monthly payee for 3+ months is Strong', () => {
    const events = ['2026-08-27', '2026-09-27', '2026-10-27'].map((date, i) => ({
      id: `e${i}`,
      operationId: `e${i}`,
      type: 'expense' as const,
      date,
      status: 'posted' as const,
      payeeId: 'p1',
      lines: [
        { ledgerAccountId: 'a1', amountMinor: -25000000n, currency: 'NGN' },
        { ledgerAccountId: 'c1', amountMinor: 25000000n, currency: 'NGN' },
      ],
    }));
    const s = stubSnapshot({ events });
    const found = findRecurringSuggestions(s, '2026-10');
    expect(found.some((f) => f.name === 'Landlord' && f.confidence === 'strong')).toBe(true);
  });

  it('PU27-2: already scheduled is not suggested', () => {
    const events = ['2026-08-27', '2026-09-27', '2026-10-27'].map((date, i) => ({
      id: `e${i}`,
      operationId: `e${i}`,
      type: 'expense' as const,
      date,
      status: 'posted' as const,
      payeeId: 'p1',
      lines: [
        { ledgerAccountId: 'a1', amountMinor: -25000000n, currency: 'NGN' },
        { ledgerAccountId: 'c1', amountMinor: 25000000n, currency: 'NGN' },
      ],
    }));
    const s = stubSnapshot({
      events,
      recurring: [
        {
          id: 'r1',
          kind: 'bill',
          name: 'Landlord',
          amountMinor: '25000000',
          accountId: 'a1',
          payeeId: 'p1',
          rule: { every: 'month', on: 27 },
          startDate: '2026-01-01',
        },
      ],
    });
    expect(findRecurringSuggestions(s, '2026-10')).toHaveLength(0);
  });

  it('PU28-1 / settings: dueSoonDays changes Due soon grouping', () => {
    const s = stubSnapshot({
      recurring: [
        {
          id: 'r1',
          kind: 'bill',
          name: 'Netflix',
          amountMinor: '500000',
          accountId: 'a1',
          categoryId: 'c1',
          rule: { every: 'month', on: 20 },
          startDate: '2026-01-01',
        },
      ],
    });
    // Due 20 Oct; from 1 Oct, 7-day window ends 8 Oct → later; 30-day window → dueSoon.
    const with7 = billsForMonth(s, '2026-10', '2026-10-01', 7);
    const with30 = billsForMonth(s, '2026-10', '2026-10-01', 30);
    expect(with7[0]?.group).toBe('later');
    expect(with30[0]?.group).toBe('dueSoon');
  });

  it('PU59-1 / TB04-1: list and calendar share the same day items', () => {
    const s = stubSnapshot({
      recurring: [
        {
          id: 'r1',
          kind: 'bill',
          name: 'Rent',
          amountMinor: '100',
          accountId: 'a1',
          categoryId: 'c1',
          rule: { every: 'month', on: 2 },
          startDate: '2026-01-01',
        },
      ],
    });
    const rows = planRowsForMonth(s, '2026-11', '2026-11-01', 7);
    const byDate = rowsByDate(rows);
    expect(byDate.get('2026-11-02')?.map((r) => r.recurring.name)).toEqual(['Rent']);
    expect(dayListTitle('2026-11-02')).toMatch(/Monday/);
    expect(dayListTitle('2026-11-02')).toMatch(/2/);
    expect(dayListTitle('2026-11-02')).toMatch(/November/);
  });

  it('TB04-2: All schedules finds by name or payee', () => {
    const s = stubSnapshot({
      recurring: [
        {
          id: 'r1',
          kind: 'bill',
          name: 'Rent',
          amountMinor: '100',
          accountId: 'a1',
          payeeId: 'p1',
          categoryId: 'c1',
          rule: { every: 'month', on: 1 },
          startDate: '2026-01-01',
        },
      ],
    });
    expect(allScheduleRows(s, '2026-10-28', 'rent')).toHaveLength(1);
    expect(allScheduleRows(s, '2026-10-28', 'landlord')).toHaveLength(1);
    expect(allScheduleRows(s, '2026-10-28', 'zzz')).toHaveLength(0);
  });

  it('TB04-3: paused schedules show Paused and create no reminders', () => {
    const s = stubSnapshot({
      recurring: [
        {
          id: 'r1',
          kind: 'bill',
          name: 'Gym',
          amountMinor: '100',
          accountId: 'a1',
          categoryId: 'c1',
          rule: { every: 'month', on: 1 },
          startDate: '2026-01-01',
          paused: true,
          reminderDays: 1,
        },
      ],
    });
    const row = allScheduleRows(s, '2026-10-28')[0]!;
    expect(row.status).toBe('paused');
    expect(scheduleCreatesReminders(row.recurring)).toBe(false);
  });
});

describe('PU-29 income stream helpers', () => {
  it('PU29-2: Passive streams default Count in budget off', () => {
    expect(defaultCountInBudget('passive')).toBe(false);
    expect(defaultCountInBudget('regular')).toBe(true);
  });

  it('PU29-3: routing cannot exceed income', () => {
    expect(routingExceedsIncome({ expectedMinor: '100000', routing: [{ amountMinor: '60000' }, { amountMinor: '50000' }] })).toBe(true);
    expect(routingExceedsIncome({ expectedMinor: '100000', routing: [{ percent: 60 }, { percent: 50 }] })).toBe(true);
    expect(routingExceedsIncome({ expectedMinor: '100000', routing: [{ amountMinor: '40000' }, { restToBudget: true }] })).toBe(false);
  });

  it('PU29-1: deductions over gross are refused', () => {
    expect(
      deductionsExceedGross({
        expectedMinor: '100',
        recordMode: 'gross',
        grossMinor: '100000',
        deductions: [{ kind: 'paye', amountMinor: '120000' }],
      }),
    ).toBe(true);
  });
});
