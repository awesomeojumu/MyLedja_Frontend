import type { ApiClient } from './client';
import type { components } from './types';

type Schemas = components['schemas'];

export type Reconciliation = Schemas['Reconciliation'];
export type ReconcileView = Schemas['ReconcileView'];

/** Account reconcile against a bank statement (DESIGN page 10, B1.13). */
export function reconcileApi(client: ApiClient) {
  return {
    start: (
      workspaceId: string,
      accountId: string,
      body: { id?: string; statementDate: string; statementBalance: string },
    ) =>
      client.request<ReconcileView>(
        'POST',
        `/v1/workspaces/${workspaceId}/accounts/${accountId}/reconciliations`,
        body,
      ),
    history: (workspaceId: string, accountId: string) =>
      client.request<{ reconciliations: Reconciliation[] }>(
        'GET',
        `/v1/workspaces/${workspaceId}/accounts/${accountId}/reconciliations`,
      ),
    get: (workspaceId: string, reconciliationId: string) =>
      client.request<ReconcileView>('GET', `/v1/workspaces/${workspaceId}/reconciliations/${reconciliationId}`),
    tick: (
      workspaceId: string,
      reconciliationId: string,
      body: { transactionIds: string[]; cleared: boolean },
    ) =>
      client.request<ReconcileView>(
        'POST',
        `/v1/workspaces/${workspaceId}/reconciliations/${reconciliationId}/tick`,
        body,
      ),
    finish: (workspaceId: string, reconciliationId: string, body: { adjust?: boolean }) =>
      client.request<ReconcileView>(
        'POST',
        `/v1/workspaces/${workspaceId}/reconciliations/${reconciliationId}/finish`,
        { adjust: body.adjust ?? false },
      ),
    cancel: (workspaceId: string, reconciliationId: string) =>
      client.request<Reconciliation>(
        'POST',
        `/v1/workspaces/${workspaceId}/reconciliations/${reconciliationId}/cancel`,
      ),
    unlock: (workspaceId: string, transactionId: string) =>
      client.request<Schemas['Transaction']>(
        'POST',
        `/v1/workspaces/${workspaceId}/transactions/${transactionId}/unlock`,
        { confirm: true },
      ),
  };
}

export type ReconcileApi = ReturnType<typeof reconcileApi>;
