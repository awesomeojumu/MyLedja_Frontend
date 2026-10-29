import type { ApiClient } from './client';
import type { components } from './types';

type CashFlow = components['schemas']['CashFlow'];

export type CashFlowQuery = {
  from: string;
  to: string;
  accountIds?: string[];
  includeTransfers?: boolean;
};

/** Reports read API — cash flow (TECH-SPEC §8 / DESIGN page 22). */
export function reportsApi(client: ApiClient) {
  return {
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
