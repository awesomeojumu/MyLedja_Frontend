import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Badge, Button, EmptyState, HeroBalance, SectionHeader, TransactionRow, Txt, useTheme } from "@/design";
import { AccountManageSheet } from "@/features/accounts/components/AccountManageSheet";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = { accounts: [] as ReturnType<typeof toLedgerAccount>[], txns: [] as ApiTransaction[] };

function kindLabel(kind: string): string {
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Account";
}

export function AccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const [accountsRes, txRes] = await Promise.all([
        session.listAccounts(workspaceId),
        session.listTransactions(workspaceId),
      ]);
      const accounts = (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) =>
        toLedgerAccount(row as ApiAccount),
      );
      const txns = (txRes.data.transactions ?? []).filter((row) => row.id);
      return { accounts, txns };
    },
    [session],
  );
  const { data } = useLiveQuery(load, EMPTY, id ? `account:${id}` : "account");
  const [manage, setManage] = useState(false);
  const account = data.accounts.find((row) => row.id === id);
  const names = new Map(data.accounts.map((row) => [row.id, row.name]));
  const activity = data.txns.filter((row) => row.accountId === id || row.toAccountId === id);

  return (
    <AccountScreenShell
      title={account?.name ?? "Account"}
      showBack
      actions={
        account ? [{ icon: "ellipsis", label: "Manage", onPress: () => setManage(true) }] : undefined
      }
    >
      {!account && data.accounts.length > 0 ? (
        <Txt variant="body" color={t.c.inkMuted}>
          Account not in this workspace
        </Txt>
      ) : !account ? null : (
        <>
          <HeroBalance value={account.balance} label="Balance" freshness={account.institution || undefined} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Badge tone="primary" icon="wallet">
              {kindLabel(account.kind)}
            </Badge>
            {account.institution ? (
              <Badge tone="neutral" icon={false}>
                {account.institution}
              </Badge>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button fullWidth onPress={() => router.push("/(tabs)/accounts/transfer")}>
                Transfer
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button fullWidth variant="secondary" onPress={() => router.push("/(tabs)/transactions/chooser")}>
                Add
              </Button>
            </View>
          </View>
          <SectionHeader title="Activity" />
          {activity.length === 0 ? (
            <EmptyState title="Nothing here yet" icon="inbox">
              Add a transfer or expense and it will show on this account.
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
              {activity.map((row) => (
                <TransactionRow
                  key={String(row.id)}
                  title={row.description || "Transaction"}
                  category={row.type}
                  account={names.get(String(row.accountId)) ?? ""}
                  amount={nairaAmount(row.amount)}
                  kind={rowKind(row.type)}
                  onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
                />
              ))}
            </View>
          )}
          <AccountManageSheet key={account.id} account={account} open={manage} onClose={() => setManage(false)} />
        </>
      )}
    </AccountScreenShell>
  );
}
