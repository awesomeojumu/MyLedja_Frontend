import type { ApiClient } from './client';
import type { BuilderSpecModel, ReportFiltersModel } from '@/data/workspace/model';

/**
 * Hand-typed Reports API until coordinator `api:sync` lands tip OpenAPI reports paths
 * (shared-request-page-21; BE already exposes these on tip).
 */

export type RunReportBody = {
  kind: 'custom';
  from: string;
  to: string;
  interval?: 'day' | 'week' | 'month' | 'year';
  compare?: boolean;
  filters?: ReportFiltersModel;
  spec?: BuilderSpecModel;
  savedReportId?: string;
};

export type ReportTableDto = {
  columns: { key: string; label: string }[];
  rows: { key: string; label: string; values: string[]; total: string }[];
  columnTotals: string[];
  total: string;
};

export type ReportResultDto = {
  kind: string;
  from: string;
  to: string;
  interval: string;
  chart: string;
  unit: 'money' | 'count' | 'days' | 'basis_points';
  table: ReportTableDto;
  previous: ReportTableDto | null;
  finding: unknown;
  drill: Record<string, unknown>;
  partial: string[];
  note: string | null;
};

export type SavedReportDto = {
  id: string;
  name: string;
  spec: BuilderSpecModel;
  version: number;
};

export function reportsApi(client: ApiClient) {
  return {
    run: (workspaceId: string, body: RunReportBody) =>
      client.request<ReportResultDto>('POST', `/v1/workspaces/${workspaceId}/reports/run`, body),
    listSaved: (workspaceId: string) =>
      client.request<{ items: SavedReportDto[] }>('GET', `/v1/workspaces/${workspaceId}/reports/saved`),
    createSaved: (workspaceId: string, body: { id?: string; name: string; spec: BuilderSpecModel; dashboardId?: string }) =>
      client.request<SavedReportDto>('POST', `/v1/workspaces/${workspaceId}/reports/saved`, body),
  };
}

export type ReportsApi = ReturnType<typeof reportsApi>;
