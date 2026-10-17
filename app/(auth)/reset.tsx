import { useRouter } from "expo-router";
import { afterReset, AUTH_ROUTES, RecoveryResetScreen } from "@/features/auth-onboarding";
import { useSession } from "@/state";

export default function ResetRoute() {
  const router = useRouter();
  const { session, pendingEmail } = useSession();
  return (
    <RecoveryResetScreen
      email={pendingEmail}
      onBack={() => router.back()}
      onSubmit={async ({ code, password }) => {
        await session.confirmRecovery(code, password);
        router.replace(afterReset());
      }}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
