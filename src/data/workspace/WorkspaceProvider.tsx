import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSync } from '../sync/SyncProvider';
import { WorkspaceRepository, type Snapshot } from './repository';

type WorkspaceContext = { repo: WorkspaceRepository; snapshot: Snapshot | null };

const Context = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const { store, engine } = useSync();
  const repo = useMemo(() => new WorkspaceRepository(store, engine, workspaceId), [store, engine, workspaceId]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void repo.load().then((s) => alive && setSnapshot(s));
    };
    refresh();
    const unsubscribe = store.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [repo, store]);

  return <Context.Provider value={{ repo, snapshot }}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceContext {
  const value = useContext(Context);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
