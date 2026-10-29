import type { ReportCardKind } from '@/data/workspace/model';

import type { ReportKind } from '@/api/reports';

/** Tip dashboard kinds (camelCase) → BE `ReportKind` (snake_case). */
export const KIND_TO_API: Record<ReportCardKind, ReportKind> = {
  spendingByCategory: 'spending_by_category',
  incomeVsSpending: 'income_vs_expenses',
  netWorth: 'net_worth',
  cashFlow: 'cash_flow',
  budgetProgress: 'budget_analysis',
  custom: 'custom',
};

export function apiKind(kind: ReportCardKind): ReportKind {
  return KIND_TO_API[kind];
}

/** Kinds that accept a different group-by via a custom builder spec. */
export function canRegroup(kind: ReportCardKind): boolean {
  return kind === 'spendingByCategory' || kind === 'custom';
}
