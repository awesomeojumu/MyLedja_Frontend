import { useRouter } from "expo-router";
import { useState } from "react";
import { Banner, Button, TextField, Txt } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { useSession } from "@/state";

const SAMPLE = `posted_at,narration,amount,type
2026-10-02,SHOPRITE,25.00,expense`;

export function ImportStatementScreen() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [text, setText] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AccountScreenShell
      title="Import bank statement"
      emptyTitle="No statement yet"
      errorTitle="Could not read this statement"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() => {
            const workspaceId = workspaces[0]?.id;
            if (!workspaceId) return;
            setBusy(true);
            void session
              .previewImport(workspaceId, text)
              .then((res) => router.push(`/(tabs)/accounts/import-review?importId=${res.data.importId}`))
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(false));
          }}
        >
          Preview
        </Button>
      }
    >
      <Banner tone="primary" title="CSV first">Preview every row before it is recorded.</Banner>
      {error ? <Txt variant="body">{error}</Txt> : null}
      <TextField label="CSV" value={text} onChangeText={setText} />
    </AccountScreenShell>
  );
}
