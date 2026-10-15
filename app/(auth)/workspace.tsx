import { useRouter } from "expo-router";
import { afterWorkspace, CreateWorkspaceScreen } from "../../src/features/auth-onboarding";

export default function WorkspaceRoute() {
  const router = useRouter();
  return <CreateWorkspaceScreen onBack={() => router.back()} onSubmit={() => router.push(afterWorkspace())} />;
}
