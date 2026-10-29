import { dueDateInMonth, dueDatesInMonth, lastDayOfMonth } from '../recurrence';

describe('recurrence (P12-03)', () => {
  it('day 31 falls on the last day of shorter months', () => {
    expect(lastDayOfMonth(2026, 1)).toBe(28);
    expect(dueDateInMonth({ every: 'month', on: 31 }, '2026-02')).toBe('2026-02-28');
    expect(dueDateInMonth({ every: 'month', on: 31 }, '2026-01')).toBe('2026-01-31');
  });

  it('day 0 means last day of month (TECH-SPEC 6.4)', () => {
    expect(dueDateInMonth({ every: 'month', on: 0 }, '2026-02')).toBe('2026-02-28');
    expect(dueDateInMonth({ every: 'month', on: 0 }, '2026-11')).toBe('2026-11-30');
  });

  it('every N days produces multiple dates in month', () => {
    const dates = dueDatesInMonth({ every: 'day', on: 0, interval: 7 }, '2026-10', '2026-10-01');
    expect(dates.length).toBeGreaterThan(3);
    expect(dates[0]).toBe('2026-10-01');
  });

  it('yearly rule due once in matching month', () => {
    expect(dueDatesInMonth({ every: 'year', on: 15, monthOfYear: 10 }, '2026-10', '2020-01-01')).toEqual(['2026-10-15']);
    expect(dueDatesInMonth({ every: 'year', on: 15, monthOfYear: 11 }, '2026-10', '2020-01-01')).toEqual([]);
  });
});
