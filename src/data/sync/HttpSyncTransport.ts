import type { ApiClient } from '@/api/client';
import type { Account } from '@/data/workspace/model';

import {
  fromBackendChange,
  fromBackendResult,
  toBackendOperation,
  type BackendChange,
  type BackendOperation,
  type BackendOperationResult,
} from './mapOperation';
import type { ChangesPage, Operation, OperationResult, SyncTransport } from './types';

type PushResponse = { results: BackendOperationResult[]; seq: string };
type PullResponse = {
  changes: BackendChange[];
  nextSince: string;
  hasMore: boolean;
  reset: boolean;
};

/**
 * Real `/sync/operations` + `/sync/changes` transport (TECH-SPEC 9 / B1.11).
 * Unit tests keep using MockSyncServer; this is wired when the API source is not mock.
 */
export class HttpSyncTransport implements SyncTransport {
  constructor(
    private readonly options: {
      client: ApiClient;
      workspaceId: () => string | null;
      deviceId: string;
      accounts: () => Promise<Account[]>;
    },
  ) {}

  async postOperations(operations: Operation[]): Promise<OperationResult[]> {
    const workspaceId = this.options.workspaceId();
    if (!workspaceId) throw new Error('network');
    const accounts = await this.options.accounts();
    const mapped: BackendOperation[] = [];
    const early: OperationResult[] = [];
    for (const op of operations) {
      const next = toBackendOperation(op, accounts);
      if ('reject' in next) {
        early.push({ operationId: op.operationId, status: 'rejected', error: next.reject });
        continue;
      }
      mapped.push(next);
    }
    if (mapped.length === 0) return early;

    const res = await this.options.client.request<PushResponse>(
      'POST',
      `/v1/workspaces/${workspaceId}/sync/operations`,
      { deviceId: this.options.deviceId, operations: mapped },
      { operationId: mapped[0]!.operationId },
    );
    const fromServer = res.results.map((r) => fromBackendResult(r));
    return [...early, ...fromServer];
  }

  async getChanges(since: number): Promise<ChangesPage> {
    const workspaceId = this.options.workspaceId();
    if (!workspaceId) throw new Error('network');
    const res = await this.options.client.request<PullResponse>(
      'GET',
      `/v1/workspaces/${workspaceId}/sync/changes?since=${since}&limit=200`,
    );
    if (res.reset) {
      return { changes: [], lastSeq: 0, hasMore: false, reset: true };
    }
    const changes = res.changes.map(fromBackendChange);
    return {
      changes,
      lastSeq: Number(res.nextSince),
      hasMore: res.hasMore,
      reset: false,
    };
  }
}

/** Lets SyncProvider swap mock ↔ HTTP without rebuilding the engine. */
export class SwitchingSyncTransport implements SyncTransport {
  constructor(public inner: SyncTransport) {}

  postOperations(operations: Operation[]) {
    return this.inner.postOperations(operations);
  }

  getChanges(since: number) {
    return this.inner.getChanges(since);
  }
}
