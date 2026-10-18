import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Card, formatDateDMY, Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { toLedgerAccount, type ApiAccount } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NONE = null as ReturnType<typeof toLedgerAccount> | null;

export function ConnectionStatusScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      if (!id) return null;
      const res = await session.getAccount(workspaceId, id);
      return toLedgerAccount(res.data as ApiAccount);
    },
    [id, session],
  );
  const { data: account } = useLiveQuery(load, NONE, id ? `conn:${id}` : "conn");
  const label =
    account?.connectionType === "imported" ? "Imported" : account?.connectionType === "linked" ? "Linked" : "Manual";

  return (
    <AccountScreenShell title="Connection status" showBack>
      {account ? (
        <Card>
          <Txt variant="titleSm">Connection</Txt>
          <Txt variant="body">{label}</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>
            {account.reconciledAsOf
              ? `Last reconcile ${formatDateDMY(account.reconciledAsOf)}`
              : "No import or reconcile yet"}
          </Txt>
        </Card>
      ) : (
        <Txt variant="body" color={t.c.inkMuted}>
          Open this from an account.
        </Txt>
      )}
    </AccountScreenShell>
  );
}
