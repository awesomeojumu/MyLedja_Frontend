import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Banner, Button, StatTile, useTheme } from "../../../design";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { IMPORT_REVIEW } from "../dummy-data";

export function PreviewImportScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const counts = IMPORT_REVIEW.counts;

  return (
    <AccountScreenShell
      title="Preview import"
      emptyTitle="No rows to preview"
      errorTitle="Could not read this statement"
      footer={
        <Button fullWidth onPress={() => router.push(`/(tabs)/accounts/import-review?id=${id ?? IMPORT_REVIEW.accountId}`)}>
          Review {counts.new} new records
        </Button>
      }
    >
      <View style={{ flexDirection: "row", gap: t.space.space3 }}>
        <StatTile label="New" count={counts.new} note="Will be added" />
        <StatTile label="Duplicates" count={counts.duplicates} note="Skipped" />
        <StatTile label="Need a look" count={counts.look} note="Decide first" />
      </View>
      <Banner tone="positive" title="Balances will match">
        {`After this import ${IMPORT_REVIEW.accountName} will show the statement closing balance.`}
      </Banner>
    </AccountScreenShell>
  );
}
