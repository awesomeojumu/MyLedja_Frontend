import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Banner, Button, Card, Select, Txt, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { ACCOUNTS, IMPORT_REVIEW, accountById } from "@/features/accounts/dummy-data";

export function ImportStatementScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const options = ACCOUNTS.map((account) => ({ value: account.id, label: account.name }));
  const initial = id && ACCOUNTS.some((account) => account.id === id) ? id : IMPORT_REVIEW.accountId;
  const [accountId, setAccountId] = useState(initial);
  const account = accountById(accountId);

  return (
    <AccountScreenShell
      title="Import bank statement"
      demo
      emptyTitle="No statement yet"
      emptyBody="Choose a CSV from your bank or wallet, then preview every row."
      errorTitle="Could not read this statement"
      errorBody="The file could not be opened. Try another CSV."
      footer={
        <Button fullWidth onPress={() => router.push(`/(tabs)/accounts/import-review?id=${accountId}`)}>
          Use {IMPORT_REVIEW.fileName}
        </Button>
      }
    >
      <WidePane
        sidebar={
          <Banner tone="primary" title="CSV first">
            Preview every row before it is recorded. Duplicates stay skipped.
          </Banner>
        }
      >
      <Select label="Account" options={options} value={accountId} onChange={setAccountId} />
      <Card title="Ready file">
        <Txt variant="titleSm">{IMPORT_REVIEW.fileName}</Txt>
        <Txt variant="bodySm" color={t.c.inkMuted}>
          Dummy September statement for {account?.name ?? "this account"}.
        </Txt>
      </Card>
      </WidePane>
    </AccountScreenShell>
  );
}
