import { useRouter } from "expo-router";
import { afterPreferences, InitialPreferencesScreen } from "@/features/auth-onboarding";
import { preferencesPatch } from "@/features/auth-onboarding/services/preferences-patch";
import { useSession } from "@/state";

export default function PreferencesRoute() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  return (
    <InitialPreferencesScreen
      onSubmit={async (prefs) => {
        const workspaceId = workspaces[0]?.id;
        if (workspaceId) {
          await session.patchSetup(workspaceId, preferencesPatch(prefs));
        }
        router.push(afterPreferences());
      }}
    />
  );
}
