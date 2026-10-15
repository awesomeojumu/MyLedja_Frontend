import { useRouter } from "expo-router";
import { afterMfa, AUTH_ROUTES, MfaScreen } from "../../src/features/auth-onboarding";

export default function MfaRoute() {
  const router = useRouter();
  return (
    <MfaScreen
      onBack={() => router.back()}
      onSubmit={() => router.replace(afterMfa())}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
