import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

import { useSync } from '../sync/SyncProvider';
import { WorkspaceRepository, type Snapshot } from './repository';

type WorkspaceContext = { repo: WorkspaceRepository; snapshot: Snapshot | null };

const Context = createContext<WorkspaceContext | null>(null);

let activeSnapshotCache: { workspaceId: string; snapshot: Snapshot } | null = null;

export function WorkspaceProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const { store, engine } = useSync();
  const { user } = useAuth();
  const repo = useMemo(() => new WorkspaceRepository(store, engine, workspaceId), [store, engine, workspaceId]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() => {
    if (activeSnapshotCache && activeSnapshotCache.workspaceId === workspaceId) {
      return activeSnapshotCache.snapshot;
    }
    return null;
  });

  useEffect(() => {
    repo.setActor({ userId: user?.id ?? null });
  }, [repo, user?.id]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void repo.load().then((s) => {
        if (alive) {
          activeSnapshotCache = { workspaceId, snapshot: s };
          setSnapshot(s);
        }
      });
    };
    refresh();
    // P12-08: post due auto-create bills once when the workspace opens.
    void repo.createDueAutoTransactions().then(() => {
      if (alive) refresh();
    });
    const unsubscribe = store.subscribe(() => {
      repo.invalidateCache();
      refresh();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [repo, store, workspaceId]);

  return <Context.Provider value={{ repo, snapshot }}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceContext {
  const value = useContext(Context);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
