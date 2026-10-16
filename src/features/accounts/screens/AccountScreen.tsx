import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Amount,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  HeroBalance,
  SectionHeader,
  TransactionRow,
  Txt,
  useTheme,
} from "../../../design";
import { WidePane } from "../../../lib";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { ACCOUNT_ACTIVITY, accountById, kindLabel } from "../dummy-data";

export function AccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = accountById(String(id ?? ""));
  const [hidden, setHidden] = useState(false);
  const [blocked, setBlocked] = useState(false);

  if (!account) {
    return (
      <AccountScreenShell title="Account details" emptyTitle="This account is not on this workspace" errorTitle="Could not load this account">
        <EmptyState title="This account is not on this workspace" icon="wallet" action={{ label: "See accounts", onPress: () => router.replace("/(tabs)/accounts") }} />
      </AccountScreenShell>
    );
  }

  const activity = ACCOUNT_ACTIVITY[account.id] ?? [];
  const meta = [kindLabel(account.kind), account.institution, account.lastFour ? `•••• ${account.lastFour}` : null].filter(Boolean).join(" · ");

  return (
    <AccountScreenShell
      title={account.name}
      emptyTitle="No activity yet"
      errorTitle="Could not load this account"
      actions={[
        { icon: "pencil", label: "Edit account", onPress: () => router.push(`/(tabs)/accounts/edit?id=${account.id}`) },
        { icon: "ellipsis", label: "More", onPress: () => setBlocked(true) },
      ]}
    >
      <WidePane tablet
        sidebar={
          <HeroBalance
          label={meta}
          value={account.balance}
          currency={account.currency}
          hidden={hidden}
          onToggleHidden={() => setHidden((prev) => !prev)}
          actions={[
            { label: "Transfer", icon: "arrow-left-right", onPress: () => router.push(`/(tabs)/accounts/transfer?from=${account.id}`) },
            { label: "Reconcile", icon: "circle-check", onPress: () => router.push(`/(tabs)/accounts/reconcile?id=${account.id}`) },
          ]}
        />
        }
      >
        {account.reconciled ? (
          <Banner tone="positive" title="Reconciled">
            Last matched on {account.lastActivity}.
          </Banner>
        ) : (
          <Banner tone="warning" title="Not reconciled yet">
            Import a statement or enter the bank’s closing balance.
          </Banner>
        )}
        <Card flat>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: t.space.space2 }}>
            <Txt variant="bodySm" color={t.c.inkMuted}>
              Opening balance
            </Txt>
            <Amount value={account.kind === "cash" ? account.balance : 400000} currency={account.currency} hidden={hidden} />
          </View>
          <Txt variant="caption" color={t.c.inkMuted}>
            Opening balances are not income.
          </Txt>
        </Card>
        <SectionHeader title="Activity" action={{ label: "History", onPress: () => router.push("/(tabs)/accounts/history") }} />
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {activity.map((row) => (
            <TransactionRow
              key={row.id}
              title={row.title}
              category={row.category}
              account={account.name}
              amount={row.amount}
              kind={row.kind}
              time={row.when}
              hidden={hidden}
            />
          ))}
        </View>
        <Button variant="secondary" icon="receipt" onPress={() => router.push(`/(tabs)/accounts/institution?id=${account.id}`)}>
          Import statement
        </Button>
        <Button variant="tertiary" onPress={() => router.push(`/(tabs)/accounts/archived`)}>
          Archived accounts
        </Button>
      </WidePane>
      <Dialog
        title="Delete is blocked"
        open={blocked}
        confirmLabel="Archive instead"
        onClose={() => setBlocked(false)}
        onConfirm={() => {
          setBlocked(false);
          router.push("/(tabs)/accounts/archived");
        }}
      >
        {`We keep ${account.name} because it has transactions. Archive it so it leaves the list.`}
      </Dialog>
    </AccountScreenShell>
  );
}
