import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { afterChecklist, SetupChecklistScreen } from "@/features/auth-onboarding";
import {
  deriveSetup,
  EMPTY_SETUP,
  nextSetupStep,
  setupHref,
  type SetupProgress,
} from "@/features/auth-onboarding/services/setup-progress";
import { useSession } from "@/state";

export default function ChecklistRoute() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [progress, setProgress] = useState<SetupProgress>(EMPTY_SETUP);
  const [progressKnown, setProgressKnown] = useState(false);
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (!workspaceId) return;
    void (async () => {
      try {
      const [ws, accounts, categories, txns] = await Promise.all([
        session.getWorkspace(workspaceId),
        session.listAccounts(workspaceId).catch(() => ({ data: [] as unknown[] })),
        session.listCategories(workspaceId).catch(() => ({ data: [] as { id: string }[] })),
        session.listTransactions(workspaceId).catch(() => ({ data: { transactions: [] as unknown[] } })),
      ]);
      const rows = Array.isArray(accounts.data) ? accounts.data : [];
      const opening = rows.some((row) => {
        const rec = row as { opening?: string; openingBalance?: string };
        const value = rec.opening ?? rec.openingBalance ?? "0";
        return Number.parseFloat(String(value)) > 0;
      });
      const next = deriveSetup(
        { ...EMPTY_SETUP, ...(ws.setupProgress ?? {}) },
        {
          accounts: rows.length,
          opening,
          categories: Array.isArray(categories.data) ? categories.data.length : 0,
          transactions: (txns.data.transactions ?? []).length,
        },
      );
      setProgress(next);
      if (JSON.stringify(next) !== JSON.stringify({ ...EMPTY_SETUP, ...(ws.setupProgress ?? {}) })) {
        await session.patchSetup(workspaceId, { setupProgress: next });
      }
      } finally {
        setProgressKnown(true);
      }
    })();
  }, [session, workspaceId]);

  const goHome = () => router.replace(afterChecklist());
  const goStep = (key: keyof SetupProgress) => router.push(setupHref(key) as never);
  const goNext = () => {
    if (!progressKnown) return;
    const next = nextSetupStep(progress);
    if (!next) {
      goHome();
      return;
    }
    goStep(next.key);
  };

  return (
    <SetupChecklistScreen
      onBack={() => router.back()}
      onContinue={goNext}
      onStep={goStep}
      onSkip={goHome}
      progress={progress}
      progressKnown={progressKnown}
    />
  );
}
