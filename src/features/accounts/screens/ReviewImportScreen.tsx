import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Banner, Button, Toast, Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { lastImportPreview } from "@/features/accounts/services/import-preview";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";

export function ReviewImportScreen() {
  const t = useTheme();
  const router = useRouter();
  const { importId, accountId } = useLocalSearchParams<{ importId?: string; accountId?: string }>();
  const { session, workspaces } = useSession();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = lastImportPreview();
  const accepted = preview?.accepted ?? [];
  const rejected = preview?.rejected ?? [];

  return (
    <AccountScreenShell
      title="Review imported statement"
      emptyTitle="No rows to review"
      errorTitle="Could not read this statement"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() => {
            const workspaceId = workspaces[0]?.id;
            if (!workspaceId || !importId || !accountId) {
              setToast("Need an import and account first.");
              return;
            }
            setBusy(true);
            void session
              .commitImport(workspaceId, importId, { operationId: newId(), accountId })
              .then(() => setToast("Imported into your workspace."))
              .catch((err: Error) => setToast(err.message))
              .finally(() => setBusy(false));
          }}
        >
          Commit import
        </Button>
      }
    >
      <Banner tone="primary" title="Commit uses the preview">
        Retrying this commit keeps the same imported ids.
      </Banner>
      <Txt variant="caption" color={t.c.inkMuted}>
        Accepted
      </Txt>
      {accepted.length === 0 ? (
        <Txt variant="body">None</Txt>
      ) : (
        accepted.map((row) => (
          <Txt key={`a-${row.row}`} variant="body">
            {row.row} {row.description ?? row.narration ?? ""}
          </Txt>
        ))
      )}
      <Txt variant="caption" color={t.c.inkMuted}>
        Rejected
      </Txt>
      {rejected.length === 0 ? (
        <Txt variant="body">None</Txt>
      ) : (
        rejected.map((row) => (
          <Txt key={`r-${row.row}`} variant="body">
            {row.row} {row.narration ?? ""} {row.reason ?? ""}
          </Txt>
        ))
      )}
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            if (toast === "Imported into your workspace." && accountId) {
              router.replace(`/(tabs)/accounts/${accountId}` as never);
            } else {
              router.back();
            }
          }}
        />
      ) : null}
    </AccountScreenShell>
  );
}
