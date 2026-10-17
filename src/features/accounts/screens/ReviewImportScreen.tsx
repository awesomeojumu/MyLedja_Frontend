import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  StatTile,
  Tabs,
  Toast,
  TransactionRow,
  formatMoney,
  useTheme,
} from "@/design";
import { WidePane } from "@/lib";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { IMPORT_REVIEW, importRowsFor } from "@/features/accounts/dummy-data";
import type { ImportBucket } from "@/features/accounts/types/account";

const TAB_LABEL: Record<ImportBucket, string> = {
  new: "New",
  duplicates: "Duplicates",
  look: "Need a look",
};

export function ReviewImportScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [bucket, setBucket] = useState<ImportBucket>("new");
  const [toast, setToast] = useState<string | null>(null);
  const counts = IMPORT_REVIEW.counts;
  const rows = importRowsFor(bucket);
  const closing = formatMoney(IMPORT_REVIEW.closingBalance, "NGN");

  return (
    <AccountScreenShell
      title="Review imported statement"
      emptyTitle="No rows to review"
      errorTitle="Could not read this statement"
      backLabel="Import statement"
      onBack={() => router.replace(`/(tabs)/accounts/import?id=${id ?? IMPORT_REVIEW.accountId}`)}
      footer={
        <View style={{ flexDirection: t.widthClass === "compact" || t.portrait ? "column" : "row", gap: t.space.space3, alignItems: t.widthClass === "compact" || t.portrait ? "stretch" : "center" }}>
          <Button fullWidth={t.widthClass === "compact" || t.portrait} onPress={() => setToast(`Imported ${counts.new} records.`)}>
            Import {counts.new} records
          </Button>
          <Button variant="tertiary" onPress={() => setToast("Import report is ready on this device.")}>
            Download import report
          </Button>
        </View>
      }
    >
      <WidePane
        sidebar={
          <Banner tone="positive" title="Balances match">
            {`After this import ${IMPORT_REVIEW.accountName} will show ${closing}, the same as the statement's closing balance.`}
          </Banner>
        }
      >
      <View style={{ flexDirection: "row", gap: t.space.space3 }}>
        <StatTile label="New records" count={counts.new} note="Will be added" />
        <StatTile label="Already recorded" count={counts.duplicates} note="Skipped as duplicates" />
        <StatTile label="Need a look" count={counts.look} note="Decide before importing" />
      </View>
      <Tabs
        label="Import rows"
        tabs={[
          { value: "new", label: TAB_LABEL.new, count: counts.new },
          { value: "duplicates", label: TAB_LABEL.duplicates, count: counts.duplicates },
          { value: "look", label: TAB_LABEL.look, count: counts.look },
        ]}
        value={bucket}
        onChange={(value) => setBucket(value as ImportBucket)}
      />
      <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
        {rows.map((row) => (
          <TransactionRow
            key={row.id}
            title={row.title}
            category={row.category}
            account={`${row.when} · ${row.note}`}
            amount={row.amount}
            kind={row.kind}
          />
        ))}
      </View>
      </WidePane>
      {toast ? (
        <Toast
          message={toast}
          action={
            toast.startsWith("Imported")
              ? {
                  label: "Accounts",
                  onPress: () => router.replace("/(tabs)/accounts"),
                }
              : undefined
          }
          onClose={() => setToast(null)}
        />
      ) : null}
    </AccountScreenShell>
  );
}
