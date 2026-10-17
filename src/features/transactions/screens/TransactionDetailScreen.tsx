import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { TransactionDetail, Txt, useTheme } from "@/design";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = { txns: [] as ApiTransaction[], names: new Map<string, string>() };

export function TransactionDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
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
  const { data } = useLiveQuery(load, EMPTY, "transaction-detail");
  const row = data.txns.find((item) => item.id === id);

  return (
    <TxScreen title="Transaction" showBack>
      {!row ? (
        <Txt variant="body" color={t.c.inkMuted}>
          Transaction not in this workspace
        </Txt>
      ) : (
        <TransactionDetail
          transaction={{
            title: row.description || "Transaction",
            category: row.type,
            amount: nairaAmount(row.amount),
            kind: rowKind(row.type),
            account: data.names.get(String(row.accountId)) ?? "",
            date: row.status,
            status: row.status === "pending" ? "pending" : undefined,
          }}
        />
      )}
    </TxScreen>
  );
}
