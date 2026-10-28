import { dueDateInMonth, lastDayOfMonth } from '../recurrence';

describe('recurrence (P12-03)', () => {
  it('day 31 falls on the last day of shorter months', () => {
    expect(lastDayOfMonth(2026, 1)).toBe(28);
    expect(dueDateInMonth({ every: 'month', on: 31 }, '2026-02')).toBe('2026-02-28');
    expect(dueDateInMonth({ every: 'month', on: 31 }, '2026-01')).toBe('2026-01-31');
  });
});
