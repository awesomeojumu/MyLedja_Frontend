import { useCallback } from "react";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { WorkspaceLiveList } from "@/lib/workspace-live-list";
import { useSession } from "@/state";

export function OpeningBalanceScreen() {
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const res = await session.listAccounts(workspaceId);
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map((row) => {
        const rec = row as { id?: string; name?: string };
        return { id: String(rec.id ?? ""), name: rec.name };
      });
    },
    [session],
  );
  return (
    <AccountScreenShell title="Opening balance" showBack>
      <WorkspaceLiveList load={load} empty="Add an account first" />
    </AccountScreenShell>
  );
}
