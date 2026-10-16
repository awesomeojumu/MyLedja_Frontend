import { useRouter } from "expo-router";
import { View } from "react-native";
import { Banner, TransactionRow, useTheme } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { REVIEW_ROWS } from "../dummy-data";

export function NeedsReviewScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <TxScreen
      title="Needs review"
      emptyTitle="Nothing needs a look"
      emptyBody="Failed syncs and unclear imports will land here."
      errorTitle="Could not load records that need a look"
    >
      <Banner tone="warning" title={`${REVIEW_ROWS.length} to check`}>
        These dummy rows did not sync. They are still on this phone.
      </Banner>
      <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
        {REVIEW_ROWS.map((row) => (
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
