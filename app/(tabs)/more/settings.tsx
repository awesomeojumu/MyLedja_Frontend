import { useRouter } from "expo-router";
import { AccountCard, HubScreen } from "../../../src/features/settings-privacy";
import { useSession, useSignOut } from "../../../src/state";

export default function SettingsRoute() {
  const router = useRouter();
  const { user } = useSession();
  const signOut = useSignOut();
  return (
    <HubScreen
      onBack={() => router.back()}
      header={<AccountCard email={user?.email ?? null} onSignOut={signOut} />}
    />
  );
}
