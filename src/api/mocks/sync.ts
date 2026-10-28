import type { Change, ChangesPage, LocalRecord, Operation, OperationResult, SyncTransport } from '@/data/sync/types';

/**
 * A stand-in for `/sync/operations` and `/changes` until the backend contract lands.
 * Payloads are `{ collection, id, data }` or `{ collection, id, delete: true }`.
 */
export class MockSyncServer implements SyncTransport {
  readonly records = new Map<string, LocalRecord>();
  readonly feed: Change[] = [];
  private readonly results = new Map<string, OperationResult>();
  offline = false;
  reject: ((op: Operation) => string | null) | null = null;

  async postOperations(operations: Operation[]): Promise<OperationResult[]> {
    if (this.offline) throw new Error('network');
    return operations.map((op) => this.applyOne(op));
  }

  async getChanges(since: number): Promise<ChangesPage> {
    if (this.offline) throw new Error('network');
    const changes = this.feed.filter((c) => c.seq > since).slice(0, 100);
    const lastSeq = changes.at(-1)?.seq ?? since;
    return { changes, lastSeq, hasMore: this.feed.some((c) => c.seq > lastSeq) };
  }

  private applyOne(op: Operation): OperationResult {
    const first = this.results.get(op.operationId);
    if (first) return first.status === 'applied' ? { ...first, status: 'duplicate' } : first;

    const reason = this.reject?.(op);
    if (reason) return this.remember({ operationId: op.operationId, status: 'rejected', error: reason });

    const { collection, id, data } = op.payload as { collection: string; id: string; data?: Record<string, unknown>; delete?: boolean };
    const key = `${collection}:${id}`;
    const current = this.records.get(key);
    if (current && op.baseVersion !== undefined && op.baseVersion < current.version) {
      return this.remember({ operationId: op.operationId, status: 'conflict', record: current });
    }
    if ((op.payload as { delete?: boolean }).delete) {
      this.records.delete(key);
      this.feed.push({ seq: this.feed.length + 1, op: 'tombstone', collection, id });
      return this.remember({ operationId: op.operationId, status: 'applied' });
    }
    const record: LocalRecord = { id, collection, version: (current?.version ?? 0) + 1, data: data ?? {} };
    this.records.set(key, record);
    this.feed.push({ seq: this.feed.length + 1, op: 'upsert', record });
    return this.remember({ operationId: op.operationId, status: 'applied', record });
  }

  private remember(result: OperationResult): OperationResult {
    this.results.set(result.operationId, result);
    return result;
  }
}
