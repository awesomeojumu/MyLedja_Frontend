import { useCallback } from "react";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { WorkspaceLiveList } from "@/lib/workspace-live-list";
import { useSession } from "@/state";

export function InstitutionScreen() {
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const res = await session.listAccounts(workspaceId);
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map((row) => {
        const rec = row as { id?: string; name?: string; institution?: string };
        return { id: String(rec.id ?? ""), name: rec.institution ?? rec.name };
      });
    },
    [session],
  );
  return (
    <AccountScreenShell title="Institution" showBack>
      <WorkspaceLiveList load={load} empty="No linked institutions" />
    </AccountScreenShell>
  );
}
