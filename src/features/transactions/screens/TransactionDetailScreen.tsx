import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Dialog, TransactionDetail, Txt, useTheme } from "@/design";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useSession } from "@/state";

const EMPTY = { txns: [] as ApiTransaction[], names: {} as Record<string, string> };

export function TransactionDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const load = useCallback(
    async (wsId: string) => {
      const [txRes, accountsRes] = await Promise.all([
        session.listTransactions(wsId),
        session.listAccounts(wsId),
      ]);
      const names = Object.fromEntries(
        (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) => {
          const account = toLedgerAccount(row as ApiAccount);
          return [account.id, account.name] as const;
        }),
      ) as Record<string, string>;
      return { txns: (txRes.data.transactions ?? []).filter((row) => row.id), names };
    },
    [session],
  );
  const { data } = useLiveQuery(load, EMPTY, "transaction-detail");
  const row = data.txns.find((item) => item.id === id);

  const handleVoid = async () => {
    if (!row || !workspaceId) return;
    try {
      await session.setTransactionStatus(workspaceId, row.id, "voided");
      setVoidDialogOpen(false);
      router.back();
    } catch {
      setVoidDialogOpen(false);
    }
  };

  return (
    <TxScreen title="Transaction" showBack>
      {!row ? (
        <Txt variant="body" color={t.c.inkMuted}>
          Transaction not in this workspace
        </Txt>
      ) : (
        <View style={{ gap: t.space.space4 }}>
          <TransactionDetail
            transaction={{
              title: row.description || "Transaction",
              category: row.type,
              amount: nairaAmount(row.amount),
              kind: rowKind(row.type),
              account: data.names[String(row.accountId)] ?? "",
              date: row.occurredAt ?? "",
              status: row.status === "pending" ? "pending" : undefined,
            }}
          />

          <View style={{ gap: t.space.space3, marginTop: t.space.space2 }}>
            <View style={{ flexDirection: "row", gap: t.space.space2 }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="primary"
                  fullWidth
                  onPress={() => router.push(`/(tabs)/transactions/edit?id=${row.id}`)}
                >
                  Edit
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  fullWidth
                  onPress={() => router.push(`/(tabs)/transactions/split?id=${row.id}`)}
                >
                  Split
                </Button>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: t.space.space2 }}>
              {rowKind(row.type) === "expense" ? (
                <View style={{ flex: 1 }}>
                  <Button
                    variant="secondary"
                    fullWidth
                    onPress={() => router.push(`/(tabs)/transactions/refund?id=${row.id}`)}
                  >
                    Refund
                  </Button>
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  fullWidth
                  onPress={() => router.push(`/(tabs)/transactions/history?id=${row.id}`)}
                >
                  History
                </Button>
              </View>
            </View>

            <Button
              variant="destructive"
              fullWidth
              onPress={() => setVoidDialogOpen(true)}
            >
              Void transaction
            </Button>
          </View>

          <Dialog
            title="Void transaction?"
            open={voidDialogOpen}
            onClose={() => setVoidDialogOpen(false)}
            tone="destructive"
            confirmLabel="Void transaction"
            onConfirm={handleVoid}
          >
            <Txt>
              Voiding stops this transaction from counting in totals, balances, and reports,
              while preserving it safely in audit history.
            </Txt>
          </Dialog>
        </View>
      )}
    </TxScreen>
  );
}
