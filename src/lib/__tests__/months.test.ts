import { monthCodeOf, monthLabel, shiftMonth, thisMonthCode } from '../months';

describe('months', () => {
  it('reads and writes labels', () => {
    expect(monthCodeOf('November 2026')).toBe('2026-11');
    expect(monthLabel('2026-01')).toBe('January 2026');
  });
  it('moves across a year end', () => {
    expect(shiftMonth('December 2026', 1)).toBe('January 2027');
    expect(shiftMonth('January 2027', -1)).toBe('December 2026');
  });
  it('falls back to this month for anything unreadable', () => {
    expect(monthCodeOf('soon')).toBe(thisMonthCode());
  });
});
