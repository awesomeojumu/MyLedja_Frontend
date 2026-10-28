import { MockSyncServer } from '@/api/mocks/sync';

import { MemoryKeyValue } from '../../kv.shared';
import { LocalStore } from '../LocalStore';
import { BATCH_SIZE, RETRY_WAITS_MS, STEADY_WAIT_MS, SyncEngine, waitAfter } from '../SyncEngine';

let devices = 0;

function setup(kv = new MemoryKeyValue(), server = new MockSyncServer()) {
  const device = ++devices;
  let clock = Date.parse('2026-10-28T09:00:00Z');
  let n = 0;
  const store = new LocalStore(kv);
  const engine = new SyncEngine({ store, transport: server, deviceId: 'phone', now: () => clock, newId: () => `op-${device}-${String(++n).padStart(4, '0')}` });
  return { kv, server, store, engine, tick: (ms: number) => (clock += ms), now: () => clock };
}

const expense = (id: string, amount: string) => ({ id, collection: 'transactions', version: 0, data: { amountMinor: amount } });
const payload = (id: string, amount: string) => ({ collection: 'transactions', id, data: { amountMinor: amount } });

describe('airplane mode', () => {
  it('queues while offline, survives a restart, and sends once', async () => {
    const a = setup();
    a.engine.online = false;
    a.server.offline = true;
    await a.engine.save(expense('t1', '1845000'), 'transaction.create', payload('t1', '1845000'));
    expect(await a.engine.status()).toEqual({ state: 'offline', waiting: 1, rejected: 0 });
    expect((await a.store.read('transactions', 't1'))?.data).toEqual({ amountMinor: '1845000' });

    const b = setup(a.kv, a.server);
    expect(await b.store.outbox()).toHaveLength(1);
    a.server.offline = false;
    await b.engine.wake();
    await b.engine.wake();
    expect(a.server.feed).toHaveLength(1);
    expect(await b.engine.status()).toEqual({ state: 'synced', waiting: 0, rejected: 0 });
    expect((await b.store.read('transactions', 't1'))?.version).toBe(1);
  });

  it('a resent operation is answered as a duplicate and counted once', async () => {
    const a = setup();
    const op = await a.engine.save(expense('t1', '100'), 'transaction.create', payload('t1', '100'));
    await a.server.postOperations([op]);
    await a.engine.sync();
    expect(a.server.records.size).toBe(1);
    expect(a.server.feed).toHaveLength(1);
    expect(await a.store.outbox()).toHaveLength(0);
  });

  it('sends in the order changes were made, at most 50 a batch', async () => {
    const a = setup();
    const spy = jest.spyOn(a.server, 'postOperations');
    for (let i = 0; i < BATCH_SIZE + 3; i++) await a.engine.save(expense(`t${i}`, '1'), 'transaction.create', payload(`t${i}`, '1'));
    await a.engine.sync();
    expect(spy.mock.calls.map((c) => c[0].length)).toEqual([BATCH_SIZE, 3]);
    expect(spy.mock.calls[0]![0].map((o) => o.operationId)).toEqual([...spy.mock.calls[0]![0].map((o) => o.operationId)].sort());
  });
});

describe('retries', () => {
  it('waits 2 s, 5 s, 15 s, 1 min and 5 min, then every 15 minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(waitAfter)).toEqual([...RETRY_WAITS_MS, STEADY_WAIT_MS, STEADY_WAIT_MS]);
  });

  it('does not resend before the wait, and does when the network returns', async () => {
    const a = setup();
    a.server.offline = true;
    await a.engine.save(expense('t1', '1'), 'transaction.create', payload('t1', '1'));
    await a.engine.sync();
    expect((await a.store.outbox())[0]?.attempts).toBe(1);
    a.server.offline = false;
    a.tick(1_000);
    await a.engine.sync();
    expect(a.server.feed).toHaveLength(0);
    a.tick(1_000);
    await a.engine.sync();
    expect(a.server.feed).toHaveLength(1);

    a.server.offline = true;
    await a.engine.save(expense('t2', '1'), 'transaction.create', payload('t2', '1'));
    await a.engine.sync();
    a.server.offline = false;
    await a.engine.wake();
    expect(a.server.feed).toHaveLength(2);
  });

  it('a rejected change stops retrying and can be discarded', async () => {
    const a = setup();
    a.server.reject = () => 'refund_too_large';
    const op = await a.engine.save(expense('t1', '1'), 'transaction.create', payload('t1', '1'));
    await a.engine.sync();
    await a.engine.sync({ force: true });
    expect(await a.store.outbox()).toEqual([expect.objectContaining({ state: 'rejected', error: 'refund_too_large' })]);
    expect(await a.engine.status()).toEqual({ state: 'synced', waiting: 0, rejected: 1 });
    await a.engine.discard(op.operationId);
    expect(await a.store.outbox()).toHaveLength(0);
  });
});

describe('conflicts and the change feed', () => {
  it('keeps both versions when another device changed the record first', async () => {
    const server = new MockSyncServer();
    const phone = setup(new MemoryKeyValue(), server);
    const laptop = setup(new MemoryKeyValue(), server);
    await phone.engine.save(expense('t1', '100'), 'transaction.create', payload('t1', '100'));
    await phone.engine.sync();
    await laptop.engine.sync();

    await laptop.engine.save(expense('t1', '200'), 'transaction.correct', payload('t1', '200'), 1);
    await laptop.engine.sync();
    await phone.engine.save(expense('t1', '300'), 'transaction.correct', payload('t1', '300'), 1);
    await phone.engine.sync();

    const [conflict] = await phone.store.conflicts();
    expect(conflict?.operation.payload).toEqual(payload('t1', '300'));
    expect(conflict?.server.data).toEqual({ amountMinor: '200' });
    expect((await phone.store.read('transactions', 't1'))?.data).toEqual({ amountMinor: '200' });
    await phone.store.dismissConflict(conflict!.operation.operationId);
    expect(await phone.store.conflicts()).toEqual([]);
  });

  it('applies tombstones from other devices', async () => {
    const server = new MockSyncServer();
    const phone = setup(new MemoryKeyValue(), server);
    const laptop = setup(new MemoryKeyValue(), server);
    await phone.engine.save(expense('t1', '1'), 'transaction.create', payload('t1', '1'));
    await phone.engine.sync();
    await laptop.engine.sync();
    await laptop.engine.save(expense('t1', '1'), 'category.delete', { collection: 'transactions', id: 't1', delete: true });
    await laptop.engine.sync();
    await phone.engine.sync();
    expect(await phone.store.read('transactions', 't1')).toBeNull();
    expect(await phone.store.lastSeq()).toBe(2);
  });

  it('after more than 180 days offline, sends first, then downloads the workspace again', async () => {
    const a = setup();
    await a.engine.save(expense('t1', '1'), 'transaction.create', payload('t1', '1'));
    await a.engine.sync();
    await a.store.replace(expense('stale', '9'));
    a.tick(181 * 24 * 60 * 60 * 1000);
    await a.engine.save(expense('t2', '1'), 'transaction.create', payload('t2', '1'));
    await a.engine.sync();
    expect(await a.store.read('transactions', 'stale')).toBeNull();
    expect((await a.store.list('transactions')).map((r) => r.id).sort()).toEqual(['t1', 't2']);
  });
});
