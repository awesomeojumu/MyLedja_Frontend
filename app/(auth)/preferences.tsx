import { useRouter } from "expo-router";
import { afterPreferences, InitialPreferencesScreen } from "@/features/auth-onboarding";
import { useSession } from "@/state";

export default function PreferencesRoute() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  return (
    <InitialPreferencesScreen
      onSubmit={(currency) => {
        const workspaceId = workspaces[0]?.id;
        if (workspaceId) {
          void session.patchSetup(workspaceId, { defaultCurrency: currency, setupProgress: { currency: true } });
        }
        router.push(afterPreferences());
      }}
    />
  );
}
