import { useRouter } from "expo-router";
import { afterRecover, AUTH_ROUTES, StartRecoveryScreen } from "../../src/features/auth-onboarding";

export default function RecoverRoute() {
  const router = useRouter();
  return (
    <StartRecoveryScreen
      onBack={() => router.back()}
      onSubmit={() => router.push(afterRecover())}
      onSignIn={() => router.push(AUTH_ROUTES.signIn)}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
