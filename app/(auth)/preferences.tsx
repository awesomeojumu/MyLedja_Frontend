import { useRouter } from "expo-router";
import { afterPreferences, InitialPreferencesScreen } from "../../src/features/auth-onboarding";

export default function PreferencesRoute() {
  const router = useRouter();
  return <InitialPreferencesScreen onSubmit={() => router.push(afterPreferences())} />;
}
