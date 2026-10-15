import { useRouter } from "expo-router";
import { afterReset, AUTH_ROUTES, RecoveryResetScreen } from "../../src/features/auth-onboarding";

export default function ResetRoute() {
  const router = useRouter();
  return (
    <RecoveryResetScreen
      onBack={() => router.back()}
      onSubmit={() => router.replace(afterReset())}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
