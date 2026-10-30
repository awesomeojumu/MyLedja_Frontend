import { applyDatePreset } from '../filters';
import { filtersForPeriod, periodFromFilters } from '../periodPresets';

describe('period presets (redesign chips)', () => {
  const today = '2026-10-30';

  it('maps empty dates to All', () => {
    expect(periodFromFilters({}, today)).toBe('all');
  });

  it('detects This month / Last 3 months / This year', () => {
    expect(periodFromFilters(applyDatePreset('thisMonth', today), today)).toBe('thisMonth');
    expect(periodFromFilters(applyDatePreset('last3Months', today), today)).toBe('last3Months');
    expect(periodFromFilters(applyDatePreset('thisYear', today), today)).toBe('thisYear');
  });

  it('clears dates for All and applies preset ranges', () => {
    const withMonth = filtersForPeriod('thisMonth', today, { uncategorized: true });
    expect(withMonth.uncategorized).toBe(true);
    expect(withMonth.dateFrom).toBe('2026-10-01');
    expect(filtersForPeriod('all', today, withMonth).dateFrom).toBeUndefined();
  });
});
