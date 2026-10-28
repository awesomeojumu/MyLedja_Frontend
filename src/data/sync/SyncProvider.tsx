import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { v7 as uuidv7 } from 'uuid';

import { MockSyncServer } from '@/api/mocks/sync';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnline } from '@/lib/useOnline';
import type { Account } from '@/data/workspace/model';

import { openKeyValue } from '../kv';
import { HttpSyncTransport, SwitchingSyncTransport } from './HttpSyncTransport';
import { LocalStore } from './LocalStore';
import { SyncEngine, type SyncStatus } from './SyncEngine';

type SyncContext = { store: LocalStore; engine: SyncEngine; status: SyncStatus };

const Context = createContext<SyncContext | null>(null);

const TICK_MS = 2_000;
const DEVICE_KEY = 'm:deviceId';

function createDefault(): { store: LocalStore; engine: SyncEngine; transport: SwitchingSyncTransport; deviceId: string } {
  const kv = openKeyValue();
  const store = new LocalStore(kv);
  // Live app starts on mock and swaps to HTTP when signed in against local/staging.
  const transport = new SwitchingSyncTransport(new MockSyncServer());
  const deviceId = uuidv7();
  void kv.get(DEVICE_KEY).then((existing) => {
    if (!existing) void kv.set([[DEVICE_KEY, deviceId]]);
  });
  return { store, engine: new SyncEngine({ store, transport, deviceId }), transport, deviceId };
}

export function SyncProvider({ children, value }: { children: ReactNode; value?: { store: LocalStore; engine: SyncEngine } }) {
  const auth = useAuth();
  const [{ store, engine, transport, deviceId }] = useState(() => {
    if (value) {
      return {
        store: value.store,
        engine: value.engine,
        transport: new SwitchingSyncTransport(new MockSyncServer()),
        deviceId: 'injected',
      };
    }
    return createDefault();
  });
  const online = useOnline();
  const [status, setStatus] = useState<SyncStatus>({ state: 'synced', waiting: 0, rejected: 0 });

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void engine.status().then((s) => alive && setStatus(s));
    };
    refresh();
    const unsubscribe = store.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [store, engine]);

  useEffect(() => {
    // Injected engines are driven by tests; don't wake or tick them.
    if (value) return;
    engine.setOnline(online);
    if (online) void engine.wake();
    else void engine.status().then(setStatus);
  }, [online, engine, value]);

  useEffect(() => {
    if (value) return;
    const timer = setInterval(() => void engine.sync(), TICK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void engine.wake();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [engine, value]);

  // Join the real BE transport when signed in against local/staging (leave mock for unit tests).
  useEffect(() => {
    if (value) return;
    const useHttp = auth.source !== 'mock' && auth.status === 'signed-in' && !!auth.user?.workspaceId;
    if (!useHttp) {
      if (!(transport.inner instanceof MockSyncServer)) {
        transport.inner = new MockSyncServer();
        engine.setTransport(transport);
      }
      return;
    }
    const workspaceId = auth.user!.workspaceId;
    transport.inner = new HttpSyncTransport({
      client: auth.client,
      workspaceId: () => workspaceId,
      deviceId,
      accounts: async () => {
        const rows = await store.list('accounts');
        return rows.map((r) => ({ ...(r.data as Omit<Account, 'id'>), id: r.id }));
      },
    });
    engine.setTransport(transport);
  }, [auth.source, auth.status, auth.user, auth.client, deviceId, engine, store, transport, value]);

  return <Context.Provider value={{ store, engine, status }}>{children}</Context.Provider>;
}

export function useSync(): SyncContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}

/** For the connection pill; outside a SyncProvider it reports nothing waiting. */
export function useSyncStatus(): SyncStatus | null {
  return useContext(Context)?.status ?? null;
}
