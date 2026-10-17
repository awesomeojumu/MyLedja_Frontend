import { useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { TransactionRow, Txt, useTheme } from "@/design";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = { txns: [] as ApiTransaction[], names: new Map<string, string>() };

export function TxLiveScreen({ title, empty }: { title: string; empty: string }) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const [txRes, accountsRes] = await Promise.all([
        session.listTransactions(workspaceId),
        session.listAccounts(workspaceId),
      ]);
      const names = new Map(
        (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) => {
          const account = toLedgerAccount(row as ApiAccount);
          return [account.id, account.name] as const;
        }),
      );
      return { txns: (txRes.data.transactions ?? []).filter((row) => row.id), names };
    },
    [session],
  );
  const { data } = useLiveQuery(load, EMPTY, "transactions");

  return (
    <TxScreen title={title} showBack={false}>
      {data.txns.length === 0 ? (
        <Txt variant="body" color={t.c.inkMuted}>
          {empty}
        </Txt>
      ) : (
        <View>
          {data.txns.map((row) => (
            <TransactionRow
              key={String(row.id)}
              title={row.description || "Transaction"}
              category={row.type}
              account={data.names.get(String(row.accountId)) ?? ""}
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
