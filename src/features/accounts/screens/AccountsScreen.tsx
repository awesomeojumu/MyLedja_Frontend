import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, HeroBalance, Rise, useTheme } from "../../../design";
import { ScreenShell } from "../../../lib";
import { AccountRow } from "../components/AccountRow";
import { ACCOUNTS, availableCash } from "../dummy-data";

export function AccountsScreen({ empty = false }: { empty?: boolean } = {}) {
  const t = useTheme();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const accounts = empty ? [] : ACCOUNTS;
  const total = availableCash(accounts);

  return (
    <ScreenShell
      title="Accounts"
      showBack={false}
      homeHref="/(tabs)/accounts"
      demo
      actions={[{ icon: "plus", label: "Add account", onPress: () => router.push("/(tabs)/accounts/add") }]}
      emptyTitle="No accounts yet"
      emptyBody="Add a bank, wallet or cash account. Opening balances are not income."
      emptyAction={{ label: "Add account", icon: "plus", onPress: () => router.push("/(tabs)/accounts/add") }}
      errorTitle="Could not load accounts"
    >
      <Rise delay={0}>
        <HeroBalance
          label="Available cash"
          value={total}
          currency="NGN"
          hidden={hidden}
          onToggleHidden={() => setHidden((prev) => !prev)}
          actions={[
            { label: "Add", icon: "plus", onPress: () => router.push("/(tabs)/accounts/add") },
            { label: "Transfer", icon: "arrow-left-right", onPress: () => router.push("/(tabs)/accounts/transfer") },
          ]}
        />
      </Rise>
      <Rise delay={40}>
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              hidden={hidden}
              onPress={() => router.push(`/(tabs)/accounts/${account.id}`)}
            />
          ))}
        </View>
      </Rise>
      <Button variant="secondary" icon="receipt" onPress={() => router.push("/(tabs)/accounts/import")}>
        Import statement
      </Button>
    </ScreenShell>
  );
}
