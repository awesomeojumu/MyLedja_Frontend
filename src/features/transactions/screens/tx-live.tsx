import { useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { EmptyState, TransactionRow, useTheme } from "@/design";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = { txns: [] as ApiTransaction[], names: {} as Record<string, string> };

export function TxLiveScreen({ title, empty, hub = false }: { title: string; empty: string; hub?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const [txRes, accountsRes] = await Promise.all([
        session.listTransactions(workspaceId),
        session.listAccounts(workspaceId),
      ]);
      const names = Object.fromEntries(
        (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) => {
          const account = toLedgerAccount(row as ApiAccount);
          return [account.id, account.name] as const;
        }),
      ) as Record<string, string>;
      return { txns: (txRes.data?.transactions ?? []).filter((row) => row.id), names };
    },
    [session],
  );
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, EMPTY, "transactions");
  const txns = data?.txns ?? [];
  const names = data?.names ?? EMPTY.names;
  return (
    <TxScreen
      title={title}
      showBack={!hub}
      actions={
        hub
          ? [
              { icon: "list-filter", label: "Rule preview", onPress: () => router.push("/(tabs)/transactions/rules") },
              { icon: "search", label: "Search", onPress: () => router.push("/(tabs)/transactions/search") },
            ]
          : undefined
      }
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && txns.length === 0 ? (
        <DefaultLoading />
      ) : txns.length === 0 && !known ? null : txns.length === 0 ? (
        <EmptyState title={empty} icon="inbox">
          Use + to record an expense, income, or transfer.
        </EmptyState>
      ) : (
        <View
          style={{
            borderRadius: t.radius.radiusLg,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: t.c.borderStrong,
            backgroundColor: t.c.surface,
          }}
        >
          {txns.map((row) => (
            <TransactionRow
              key={String(row.id)}
              title={row.description || "Transaction"}
              category={row.type}
              account={names[String(row.accountId)] ?? ""}
              amount={nairaAmount(row.amount)}
              kind={rowKind(row.type)}
              onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
            />
          ))}
        </View>
      )}
    </TxScreen>
  );
}
