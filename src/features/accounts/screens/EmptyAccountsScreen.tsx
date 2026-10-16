import { useRouter } from "expo-router";
import { EmptyState } from "../../../design";
import { ScreenShell } from "../../../lib";

export function EmptyAccountsScreen() {
  const router = useRouter();
  const add = { label: "Add account", icon: "plus" as const, onPress: () => router.push("/(tabs)/accounts/add") };
  return (
    <ScreenShell
      title="Accounts"
      homeHref="/(tabs)/accounts"
      emptyTitle="No accounts yet"
      emptyBody="Add a bank, wallet or cash account. Opening balances are not income."
      emptyAction={add}
      errorTitle="Could not load accounts"
    >
      <EmptyState title="No accounts yet" icon="wallet" action={add}>
        Add a bank, wallet or cash account. Opening balances are not income.
      </EmptyState>
    </ScreenShell>
  );
}
