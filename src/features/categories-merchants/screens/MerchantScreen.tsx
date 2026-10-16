import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, EmptyState, Txt } from "../../../design";
import { CatScreen } from "../components/CatScreen";
import { merchantById } from "../dummy-data";

export function MerchantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = merchantById(String(id ?? ""));
  if (!row) {
    return (
      <CatScreen title="Merchant" emptyTitle="This merchant is not on this workspace">
        <EmptyState title="This merchant is not on this workspace" icon="inbox" action={{ label: "See merchants", onPress: () => router.replace("/(tabs)/transactions/merchants") }} />
      </CatScreen>
    );
  }
  return (
    <CatScreen title={row.name} emptyTitle="No records for this merchant" errorTitle="Could not load this merchant">
      <Txt variant="titleMd">{row.name}</Txt>
      <Banner tone="primary" title={row.category}>
        {row.count} dummy records. Grouping is on this phone only.
      </Banner>
    </CatScreen>
  );
}
