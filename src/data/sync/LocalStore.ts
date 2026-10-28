import type { KeyValue } from '../kv.shared';
import type { Change, Conflict, LocalRecord, QueuedOperation } from './types';

const RECORD = 'r:';
const OUTBOX = 'o:';
const META = 'm:';
const CONFLICTS = `${META}conflicts`;

/** Outbox keys sort in the order operations were made. */
const outboxKey = (op: { createdAt: string; operationId: string }) => `${OUTBOX}${op.createdAt}:${op.operationId}`;

/**
 * The device's copy of the workspace plus its outbox, on one key-value store. An outbox
 * entry and the record it changes are written together, before the screen shows "saved".
 */
export class LocalStore {
  private readonly listeners = new Set<() => void>();

  constructor(readonly kv: KeyValue) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  async read(collection: string, id: string): Promise<LocalRecord | null> {
    const raw = await this.kv.get(`${RECORD}${collection}:${id}`);
    return raw ? (JSON.parse(raw) as LocalRecord) : null;
  }

  async list(collection: string): Promise<LocalRecord[]> {
    const keys = await this.kv.keys(`${RECORD}${collection}:`);
    const rows = await Promise.all(keys.map((k) => this.kv.get(k)));
    return rows.filter((r): r is string => r !== null).map((r) => JSON.parse(r) as LocalRecord);
  }

  /** A local change: the record and its operation in one write. */
  async write(record: LocalRecord, operation: QueuedOperation): Promise<void> {
    await this.kv.set([
      [`${RECORD}${record.collection}:${record.id}`, JSON.stringify(record)],
      [outboxKey(operation), JSON.stringify(operation)],
    ]);
    this.emit();
  }

  async outbox(): Promise<QueuedOperation[]> {
    const keys = (await this.kv.keys(OUTBOX)).sort();
    const rows = await Promise.all(keys.map((k) => this.kv.get(k)));
    return rows.filter((r): r is string => r !== null).map((r) => JSON.parse(r) as QueuedOperation);
  }

  async updateOperation(op: QueuedOperation): Promise<void> {
    await this.kv.set([[outboxKey(op), JSON.stringify(op)]]);
    this.emit();
  }

  async removeOperations(ops: QueuedOperation[]): Promise<void> {
    if (ops.length === 0) return;
    await this.kv.remove(ops.map(outboxKey));
    this.emit();
  }

  async apply(changes: Change[], lastSeq: number): Promise<void> {
    const sets: [string, string][] = [];
    const removes: string[] = [];
    for (const c of changes) {
      if (c.op === 'upsert') sets.push([`${RECORD}${c.record.collection}:${c.record.id}`, JSON.stringify(c.record)]);
      else removes.push(`${RECORD}${c.collection}:${c.id}`);
    }
    sets.push([`${META}lastSeq`, String(lastSeq)], [`${META}lastPulledAt`, new Date().toISOString()]);
    if (removes.length) await this.kv.remove(removes);
    await this.kv.set(sets);
    this.emit();
  }

  async replace(record: LocalRecord): Promise<void> {
    await this.kv.set([[`${RECORD}${record.collection}:${record.id}`, JSON.stringify(record)]]);
    this.emit();
  }

  async lastSeq(): Promise<number> {
    return Number((await this.kv.get(`${META}lastSeq`)) ?? 0);
  }

  async lastPulledAt(): Promise<Date | null> {
    const raw = await this.kv.get(`${META}lastPulledAt`);
    return raw ? new Date(raw) : null;
  }

  /** TECH-SPEC 9.7: drop the local copy (not the outbox) before downloading again. */
  async clearRecords(): Promise<void> {
    await this.kv.remove([...(await this.kv.keys(RECORD)), `${META}lastSeq`]);
    this.emit();
  }

  async conflicts(): Promise<Conflict[]> {
    const raw = await this.kv.get(CONFLICTS);
    return raw ? (JSON.parse(raw) as Conflict[]) : [];
  }

  async addConflict(conflict: Conflict): Promise<void> {
    await this.kv.set([[CONFLICTS, JSON.stringify([...(await this.conflicts()), conflict])]]);
    this.emit();
  }

  async dismissConflict(operationId: string): Promise<void> {
    const left = (await this.conflicts()).filter((c) => c.operation.operationId !== operationId);
    await this.kv.set([[CONFLICTS, JSON.stringify(left)]]);
    this.emit();
  }
}
