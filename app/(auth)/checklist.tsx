import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { afterChecklist, SetupChecklistScreen } from "@/features/auth-onboarding";
import { EMPTY_SETUP, nextSetupStep, type SetupProgress } from "@/features/auth-onboarding/services/setup-progress";
import { useSession } from "@/state";

const STEP_HREF: Record<keyof SetupProgress, string> = {
  currency: "/(auth)/preferences",
  firstAccount: "/(tabs)/accounts/add",
  opening: "/(tabs)/accounts/opening",
  categories: "/(tabs)/transactions/add-category",
  firstTransaction: "/(tabs)/transactions/add-expense",
};

export default function ChecklistRoute() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [progress, setProgress] = useState<SetupProgress>(EMPTY_SETUP);
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (!workspaceId) return;
    void session.getWorkspace(workspaceId).then((ws) => {
      const raw = ws.setupProgress ?? {};
      setProgress({ ...EMPTY_SETUP, ...raw });
    });
  }, [session, workspaceId]);

  const goHome = () => router.replace(afterChecklist());
  const goNext = () => {
    const next = nextSetupStep(progress);
    if (!next) {
      goHome();
      return;
    }
    router.push(STEP_HREF[next.key] as never);
  };

  return <SetupChecklistScreen onBack={() => router.back()} onContinue={goNext} onSkip={goHome} progress={progress} />;
}
