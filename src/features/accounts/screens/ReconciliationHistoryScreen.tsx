import { useCallback } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Amount, EmptyState, formatDateDMY, StatusBadge, Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { nairaAmount } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Row = { at: string; external: string; calculated: string; difference: string; reconciled: boolean };

const NONE: Row[] = [];

export function ReconciliationHistoryScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      if (!id) return [];
      const res = await session.listReconciliations(workspaceId, id);
      return Array.isArray(res.data) ? res.data : [];
    },
    [id, session],
  );
  const { data: rows } = useLiveQuery(load, NONE, id ? `recon:${id}` : "recon");

  return (
    <AccountScreenShell title="Reconciliation history" showBack>
      {rows.length === 0 ? (
        <EmptyState title="No reconciliations yet" icon="inbox">
          Compare a statement to store a row here.
        </EmptyState>
      ) : (
        <View style={{ gap: t.space.space3 }}>
          {rows.map((row) => (
            <View key={row.at} style={{ gap: 6 }}>
              <Txt variant="caption" color={t.c.inkMuted}>
                {formatDateDMY(row.at)}
              </Txt>
              <Amount value={nairaAmount(row.external)} />
              <Amount value={nairaAmount(row.calculated)} />
              <StatusBadge status={row.reconciled ? "reconciled" : "conflict"} label={row.reconciled ? "Matched" : "Gap"} />
            </View>
          ))}
        </View>
      )}
    </AccountScreenShell>
  );
}
