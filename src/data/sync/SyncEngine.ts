import { v7 as uuidv7 } from 'uuid';

import type { LocalStore } from './LocalStore';
import type { LocalRecord, Operation, QueuedOperation, SyncTransport } from './types';

/** TECH-SPEC 9.3: waits after each failed try, then every 15 minutes. */
export const RETRY_WAITS_MS = [2_000, 5_000, 15_000, 60_000, 300_000];
export const STEADY_WAIT_MS = 900_000;
export const BATCH_SIZE = 50;
export const SCHEMA_VERSION = 1;
const LONG_OFFLINE_MS = 180 * 24 * 60 * 60 * 1000;

export function waitAfter(attempts: number): number {
  return RETRY_WAITS_MS[attempts - 1] ?? STEADY_WAIT_MS;
}

export type SyncStatus = { state: 'synced' | 'waiting' | 'offline'; waiting: number; rejected: number };

type Options = {
  store: LocalStore;
  transport: SyncTransport;
  deviceId: string;
  now?: () => number;
  newId?: () => string;
};

/**
 * Write locally first, queue the operation, send in order, pull changes (TECH-SPEC 9).
 * The engine never decides money lines; it carries what the builders made.
 */
export class SyncEngine {
  private readonly now: () => number;
  private readonly newId: () => string;
  private transport: SyncTransport;
  private running: Promise<void> | null = null;
  online = true;

  constructor(private readonly options: Options) {
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? uuidv7;
    this.transport = options.transport;
  }

  /** Saves the record and its operation together. The screen may show it as saved once this resolves. */
  async save(record: LocalRecord, type: string, payload: Record<string, unknown>, baseVersion?: number): Promise<QueuedOperation> {
    // Each of this device's unsent writes to the same record will raise the server's version by one before this one arrives.
    const own =
      baseVersion === undefined
        ? 0
        : (await this.options.store.outbox()).filter((o) => o.state !== 'rejected' && o.payload.collection === record.collection && o.payload.id === record.id)
            .length;
    const op: QueuedOperation = {
      operationId: this.newId(),
      type,
      payload,
      baseVersion: baseVersion === undefined ? undefined : baseVersion + own,
      createdAt: new Date(this.now()).toISOString(),
      schemaVersion: SCHEMA_VERSION,
      deviceId: this.options.deviceId,
      attempts: 0,
      nextAttemptAt: 0,
      state: 'queued',
    };
    await this.options.store.write(record, op);
    return op;
  }

  async status(): Promise<SyncStatus> {
    const ops = await this.options.store.outbox();
    const rejected = ops.filter((o) => o.state === 'rejected').length;
    const waiting = ops.length - rejected;
    if (!this.online) return { state: 'offline', waiting, rejected };
    return { state: waiting > 0 ? 'waiting' : 'synced', waiting, rejected };
  }

  /** Runs one send-then-pull pass. Concurrent calls share the same pass. */
  sync(options: { force?: boolean } = {}): Promise<void> {
    this.running ??= this.pass(options.force ?? false).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Called when the network returns or the app opens: try every queued operation now. */
  async wake(): Promise<void> {
    this.online = true;
    await this.sync({ force: true });
  }

  setOnline(online: boolean) {
    this.online = online;
  }

  /** "Discard" on a rejected change. */
  async discard(operationId: string): Promise<void> {
    const ops = await this.options.store.outbox();
    await this.options.store.removeOperations(ops.filter((o) => o.operationId === operationId));
  }

  private async pass(force: boolean): Promise<void> {
    if (!this.online) return;
    const { store } = this.options;
    const lastPulled = await store.lastPulledAt();
    const longOffline = lastPulled !== null && this.now() - lastPulled.getTime() > LONG_OFFLINE_MS;

    const sent = await this.send(force);
    if (!sent) return;

    if (longOffline) await store.clearRecords();
    await this.pull();
  }

  /** Returns false when the network failed, so the pull is skipped. */
  private async send(force: boolean): Promise<boolean> {
    const { store } = this.options;
    const all = (await store.outbox()).filter((o) => o.state === 'queued');
    const due = all.findIndex((o) => !force && o.nextAttemptAt > this.now());
    const ready = due === -1 ? all : all.slice(0, due);

    for (let i = 0; i < ready.length; i += BATCH_SIZE) {
      const batch = ready.slice(i, i + BATCH_SIZE);
      let results;
      try {
        results = await this.transport.postOperations(batch.map(toOperation));
      } catch {
        for (const op of batch) {
          const attempts = op.attempts + 1;
          await store.updateOperation({ ...op, attempts, nextAttemptAt: this.now() + waitAfter(attempts) });
        }
        return false;
      }
      const done: QueuedOperation[] = [];
      for (const op of batch) {
        const result = results.find((r) => r.operationId === op.operationId);
        if (!result) continue;
        if (result.status === 'rejected') {
          await store.updateOperation({ ...op, state: 'rejected', error: result.error });
          continue;
        }
        if (result.status === 'conflict') {
          await store.addConflict({ operation: toOperation(op), server: result.record, at: new Date(this.now()).toISOString() });
          await store.replace(result.record);
        } else if (result.record) {
          await store.replace(result.record);
        }
        done.push(op);
      }
      await store.removeOperations(done);
    }
    return true;
  }

  private async pull(): Promise<void> {
    const { store } = this.options;
    let since = await store.lastSeq();
    for (;;) {
      let page;
      try {
        page = await this.transport.getChanges(since);
      } catch {
        return;
      }
      if (page.reset) {
        await store.clearRecords();
        since = 0;
        continue;
      }
      await store.apply(page.changes, page.lastSeq);
      since = page.lastSeq;
      if (!page.hasMore) return;
    }
  }

  /** Swap the live transport (mock ↔ HTTP) without dropping the outbox. */
  setTransport(transport: SyncTransport) {
    this.transport = transport;
  }
}

function toOperation(op: QueuedOperation): Operation {
  const { operationId, type, payload, baseVersion, createdAt, schemaVersion, deviceId } = op;
  return { operationId, type, payload, baseVersion, createdAt, schemaVersion, deviceId };
}
