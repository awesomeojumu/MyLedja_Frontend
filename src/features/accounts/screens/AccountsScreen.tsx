import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Amount, Card, ProgressBar, Rise, Txt, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { AccountRow } from "../components/AccountRow";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { activeAccounts, groupTotal, youOwe, youOwn } from "../dummy-data";
import type { AccountGroup } from "../types/account";

const GROUPS: { id: AccountGroup; title: string }[] = [
  { id: "cash-and-bank", title: "Cash and bank" },
  { id: "savings", title: "Savings" },
  { id: "liability", title: "You owe" },
];

export function AccountsScreen({ empty = false }: { empty?: boolean } = {}) {
  const t = useTheme();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const accounts = empty ? [] : activeAccounts();
  const own = youOwn(accounts);
  const owe = youOwe(accounts);
  const net = own - owe;
  const share = own ? Math.round((owe / own) * 100) : 0;

  const summary = (
    <Rise delay={0}>
      <Card>
        <Txt variant="label" color={t.c.inkMuted}>
          Net worth
        </Txt>
        <Amount value={net} size="xl" hidden={hidden} />
        <ProgressBar value={owe} max={own || 1} tone="danger" />
        <Txt variant="caption" color={t.c.inkMuted}>
          You owe {share}% of what you own · {accounts.length} naira accounts
        </Txt>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="caption" color={t.c.inkMuted}>
              You own
            </Txt>
            <Amount value={own} hidden={hidden} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="caption" color={t.c.inkMuted}>
              You owe
            </Txt>
            <Amount value={owe} kind="expense" hidden={hidden} />
          </View>
        </View>
      </Card>
    </Rise>
  );

  return (
    <AccountScreenShell
      title="Accounts"
      showBack={false}
      demo
      actions={[
        { icon: hidden ? "eye" : "eye-off", label: hidden ? "Show balances" : "Hide balances", onPress: () => setHidden((prev) => !prev) },
        { icon: "plus", label: "Add account", onPress: () => router.push("/(tabs)/accounts/types") },
      ]}
      emptyTitle="No accounts yet"
      emptyBody="Add a bank, wallet or cash account. Opening balances are not income."
      emptyAction={{ label: "Add account", icon: "plus", onPress: () => router.push("/(tabs)/accounts/types") }}
      errorTitle="Could not load accounts"
    >
      <WidePane tablet sidebar={summary}>
        {GROUPS.map((group) => {
          const rows = accounts.filter((account) => account.group === group.id);
          if (rows.length === 0) return null;
          return (
            <Rise key={group.id} delay={40}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
                <Txt variant="label">{group.title}</Txt>
                <Amount value={groupTotal(group.id, accounts)} size="sm" hidden={hidden} kind={group.id === "liability" ? "expense" : "neutral"} />
              </View>
              <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
                {rows.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    hidden={hidden}
                    onPress={() => router.push(`/(tabs)/accounts/${account.id}`)}
                  />
                ))}
              </View>
            </Rise>
          );
        })}
      </WidePane>
    </AccountScreenShell>
  );
}
