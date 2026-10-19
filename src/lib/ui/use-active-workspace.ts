import { useSession } from "@/state";

export function useActiveWorkspace() {
  const { workspaces } = useSession();
  const activeWorkspace = workspaces[0] ?? null;
  const workspaceId = activeWorkspace?.id ?? "";

  return {
    workspace: activeWorkspace,
    workspaceId,
    currency: activeWorkspace?.kind === "business" ? "NGN" : "NGN", // or workspace default currency
  };
}
