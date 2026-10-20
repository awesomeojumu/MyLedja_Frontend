import { useSyncExternalStore } from "react";
import { useSession } from "@/state";
import type { WorkspaceSummary } from "@/api/client";

let currentWorkspaceId: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function setActiveWorkspaceId(id: string) {
  if (currentWorkspaceId !== id) {
    currentWorkspaceId = id;
    notify();
  }
}

export function getActiveWorkspaceId(): string | null {
  return currentWorkspaceId;
}

export function useActiveWorkspace() {
  const { workspaces } = useSession();
  const selectedId = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentWorkspaceId,
    () => currentWorkspaceId,
  );

  const activeWorkspace: WorkspaceSummary | null =
    (selectedId ? workspaces.find((w) => w.id === selectedId) : null) ??
    workspaces[0] ??
    null;

  const workspaceId = activeWorkspace?.id ?? "";

  return {
    workspace: activeWorkspace,
    workspaceId,
    currency: activeWorkspace?.kind === "business" ? "NGN" : "NGN",
    setActiveWorkspaceId,
  };
}
