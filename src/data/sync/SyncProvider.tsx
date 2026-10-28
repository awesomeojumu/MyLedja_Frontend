import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { v7 as uuidv7 } from 'uuid';

import { MockSyncServer } from '@/api/mocks/sync';
import { useOnline } from '@/lib/useOnline';

import { openKeyValue } from '../kv';
import { LocalStore } from './LocalStore';
import { SyncEngine, type SyncStatus } from './SyncEngine';
import type { SyncTransport } from './types';

type SyncContext = { store: LocalStore; engine: SyncEngine; status: SyncStatus };

const Context = createContext<SyncContext | null>(null);

const TICK_MS = 2_000;

function createDefault(): { store: LocalStore; engine: SyncEngine } {
  const store = new LocalStore(openKeyValue());
  // The real transport replaces this when the backend publishes /sync/operations and /changes.
  const transport: SyncTransport = new MockSyncServer();
  return { store, engine: new SyncEngine({ store, transport, deviceId: uuidv7() }) };
}

export function SyncProvider({ children, value }: { children: ReactNode; value?: { store: LocalStore; engine: SyncEngine } }) {
  const [{ store, engine }] = useState(() => value ?? createDefault());
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
    engine.setOnline(online);
    if (online) void engine.wake();
    else void engine.status().then(setStatus);
  }, [online, engine]);

  useEffect(() => {
    const timer = setInterval(() => void engine.sync(), TICK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void engine.wake();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [engine]);

  return <Context.Provider value={{ store, engine, status }}>{children}</Context.Provider>;
}

export function useSync(): SyncContext {
  const value = useContext(Context);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}

/** For the connection pill; outside a SyncProvider it reports nothing waiting. */
export function useSyncStatus(): SyncStatus | null {
  return useContext(Context)?.status ?? null;
}
