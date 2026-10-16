import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { TextField, TransactionRow, useTheme } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { TRANSACTIONS } from "../dummy-data";

export function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const rows = TRANSACTIONS.filter((row) => {
    if (!needle) return true;
    return [row.title, row.category, row.account].join(" ").toLowerCase().includes(needle);
  });
  return (
    <TxScreen
      title="Search"
      emptyTitle="Nothing matches"
      emptyBody="Try another word. Dummy records stay on this phone."
      errorTitle="Could not search"
    >
      <TextField label="Find a record" icon="search" placeholder="Shoprite, salary, cash" value={query} onChangeText={setQuery} autoCapitalize="none" returnKeyType="search" />
      <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
        {rows.map((row) => (
          <TransactionRow
            key={row.id}
            title={row.title}
            category={row.category}
            account={row.account}
            amount={row.amount}
            kind={row.kind}
            time={row.time}
            status={row.status}
            onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
          />
        ))}
      </View>
    </TxScreen>
  );
}
