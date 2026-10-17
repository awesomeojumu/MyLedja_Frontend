import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Banner, Button, Toast } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";

export function ReviewImportScreen() {
  const router = useRouter();
  const { importId, accountId } = useLocalSearchParams<{ importId?: string; accountId?: string }>();
  const { session, workspaces } = useSession();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            router.back();
          }}
        />
      ) : null}
    </AccountScreenShell>
  );
}
