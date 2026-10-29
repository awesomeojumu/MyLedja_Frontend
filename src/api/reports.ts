import type { ApiClient } from './client';
import type { components } from './types';

type CashFlow = components['schemas']['CashFlow'];

export type CashFlowQuery = {
  from: string;
  to: string;
  accountIds?: string[];
  includeTransfers?: boolean;
};

/**
 * Hand-typed against BE `reports.contract.ts` until coordinator lands `api:sync`
 * (see internal/shared-request-page-20.md). Same wrapper style as `ai.ts`.
 */

export type ReportKind =
  | 'net_worth'
  | 'income_vs_expenses'
  | 'spending_by_category'
  | 'spending_trends'
  | 'cash_flow'
  | 'transaction_calendar'
  | 'summary_number'
  | 'budget_analysis'
  | 'age_of_money'
  | 'balance_forecast'
  | 'crossover'
  | 'investment_performance'
  | 'debt_payoff'
  | 'income_steadiness'
  | 'formula'
  | 'note'
  | 'custom';

export type ReportInterval = 'day' | 'week' | 'month' | 'year';
export type ReportChart = 'bar' | 'line' | 'area' | 'donut' | 'table' | 'number' | 'sankey' | 'calendar' | 'note';
export type ReportUnit = 'money' | 'count' | 'days' | 'basis_points';
export type ReportDimension = 'category' | 'group' | 'payee' | 'account' | 'tag' | 'month';
export type ReportMeasure = 'spending' | 'income' | 'net' | 'balance' | 'count';

export type ReportFilters = {
  accountIds?: string[];
  categoryIds?: string[];
  payeeIds?: string[];
  tagIds?: string[];
  types?: string[];
};

export type BuilderSpec = {
  show: ReportMeasure;
  groupBy: ReportDimension;
  splitBy: ReportDimension | null;
  chart: ReportChart;
  filters: ReportFilters;
};

export type RunReportBody = {
  kind: ReportKind;
  from: string;
  to: string;
  interval?: ReportInterval;
  compare?: boolean;
  filters?: ReportFilters;
  spec?: BuilderSpec;
  savedReportId?: string;
  formula?: string;
  monthsAhead?: number;
};

export type ReportTableWire = {
  columns: { key: string; label: string }[];
  rows: { key: string; label: string; values: string[]; total: string }[];
  columnTotals: string[];
  total: string;
};

export type ReportResultWire = {
  kind: ReportKind;
  from: string;
  to: string;
  interval: ReportInterval;
  chart: ReportChart;
  unit: ReportUnit;
  table: ReportTableWire;
  previous: ReportTableWire | null;
  finding: {
    key: string;
    amount: string | null;
    changeBasisPoints: string | null;
    previousFrom: string | null;
  } | null;
  drill: Record<string, ReportFilters & { from: string; to: string }>;
  partial: string[];
  note: string | null;
};

/** Reports API: the report runner (BUILD-PLAN P20) and cash flow (DESIGN page 22). */
export function reportsApi(client: ApiClient) {
  return {
    run: (workspaceId: string, body: RunReportBody) =>
      client.request<ReportResultWire>('POST', `/v1/workspaces/${workspaceId}/reports/run`, body),
    cashFlow: (workspaceId: string, q: CashFlowQuery) => {
      const params = new URLSearchParams({ from: q.from, to: q.to });
      if (q.accountIds?.length) params.set('accountIds', q.accountIds.join(','));
      if (q.includeTransfers) params.set('includeTransfers', 'true');
      else params.set('includeTransfers', 'false');
      return client.request<CashFlow>('GET', `/v1/workspaces/${workspaceId}/cash-flow?${params}`);
    },
  };
}

export type ReportsApi = ReturnType<typeof reportsApi>;
