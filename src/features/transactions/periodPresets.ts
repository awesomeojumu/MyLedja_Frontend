import { applyDatePreset, type DatePreset, type TxFilters } from './filters';

/** Period chips on redesign Transactions (Figma Phone 2:1549 / Web 31:937). */
export type PeriodChip = 'thisMonth' | 'last3Months' | 'thisYear' | 'all';

const CHIP_PRESETS: Exclude<PeriodChip, 'all'>[] = ['thisMonth', 'last3Months', 'thisYear'];

export function periodFromFilters(filters: TxFilters, todayIso: string): PeriodChip {
  if (!filters.dateFrom && !filters.dateTo) return 'all';
  for (const preset of CHIP_PRESETS) {
    const range = applyDatePreset(preset, todayIso);
    if (filters.dateFrom === range.dateFrom && filters.dateTo === range.dateTo) return preset;
  }
  return 'all';
}

export function filtersForPeriod(period: PeriodChip, todayIso: string, current: TxFilters): TxFilters {
  if (period === 'all') {
    const next = { ...current };
    delete next.dateFrom;
    delete next.dateTo;
    return next;
  }
  return { ...current, ...applyDatePreset(period as DatePreset, todayIso) };
}
