import { useRouter } from "expo-router";
import { afterChecklist, SetupChecklistScreen } from "../../src/features/auth-onboarding";

export default function ChecklistRoute() {
  const router = useRouter();
  const go = () => router.replace(afterChecklist());
  return <SetupChecklistScreen onBack={() => router.back()} onContinue={go} onSkip={go} />;
}
