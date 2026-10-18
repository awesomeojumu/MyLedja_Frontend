import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Badge, Button, Card, EmptyState, formatDateDMY, HeroBalance, SectionHeader, TransactionRow, Txt, useTheme } from "@/design";
import { AccountManageSheet } from "@/features/accounts/components/AccountManageSheet";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = { account: null as ReturnType<typeof toLedgerAccount> | null, txns: [] as ApiTransaction[] };

function kindLabel(kind: string): string {
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Account";
}

function connectionLabel(value?: string): string {
  if (value === "imported") return "Imported";
  if (value === "linked") return "Linked";
  return "Manual";
}

export function AccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      if (!id) return EMPTY;
      const [accountRes, txRes] = await Promise.all([
        session.getAccount(workspaceId, id),
        session.listTransactions(workspaceId),
      ]);
      const account = toLedgerAccount(accountRes.data as ApiAccount);
      const txns = (txRes.data.transactions ?? []).filter((row) => row.id);
      return { account, txns };
    },
    [id, session],
  );
  const { data } = useLiveQuery(load, EMPTY, id ? `account:${id}` : "account");
  const [manage, setManage] = useState(false);
  const account = data.account;
  const activity = data.txns.filter((row) => row.accountId === id || row.toAccountId === id);

  return (
    <AccountScreenShell
      title={account?.name ?? "Account"}
      showBack
      actions={
        account ? [{ icon: "ellipsis", label: "Manage", onPress: () => setManage(true) }] : undefined
      }
    >
      {!account ? null : (
        <>
          <HeroBalance value={account.balance} label="Balance" freshness={account.institution || undefined} />
          <Txt variant="caption" color={t.c.inkMuted}>
            Opening ₦{account.opening.toLocaleString("en-NG", { minimumFractionDigits: 2 })} · not income
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Badge tone="primary" icon="wallet">
              {kindLabel(account.kind)}
            </Badge>
            {account.institution ? (
              <Badge tone="neutral" icon={false}>
                {account.institution}
              </Badge>
            ) : null}
            {account.lastFour ? (
              <Badge tone="neutral" icon={false}>
                {`•••• ${account.lastFour}`}
              </Badge>
            ) : null}
            {account.connectionType ? (
              <Badge tone="neutral" icon={false}>
                {account.connectionType}
              </Badge>
            ) : null}
          </View>
          <Card>
            <Txt variant="titleSm">Connection</Txt>
            <Txt variant="body">{connectionLabel(account.connectionType)}</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              {account.reconciledAsOf
                ? `Last reconcile ${formatDateDMY(account.reconciledAsOf)}`
                : "No import or reconcile yet"}
            </Txt>
          </Card>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button fullWidth onPress={() => router.push(`/(tabs)/accounts/transfer?from=${account.id}`)}>
                Transfer
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button fullWidth variant="secondary" onPress={() => router.push("/(tabs)/transactions/chooser")}>
                Add
              </Button>
            </View>
          </View>
          <Button
            fullWidth
            variant="secondary"
            onPress={() => router.push(`/(tabs)/accounts/history?id=${account.id}`)}
          >
            Reconciliation history
          </Button>
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
                  account={account.name}
                  amount={nairaAmount(row.amount)}
                  kind={rowKind(row.type)}
                  onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
                />
              ))}
            </View>
          )}
          <AccountManageSheet
            key={`${account.id}-${account.kind}-${account.opening}-${account.archived ? "a" : "l"}`}
            account={account}
            open={manage}
            onClose={() => setManage(false)}
          />
        </>
      )}
    </AccountScreenShell>
  );
}
