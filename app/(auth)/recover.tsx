import { useRouter } from "expo-router";
import { afterRecover, AUTH_ROUTES, StartRecoveryScreen } from "@/features/auth-onboarding";
import { useSession } from "@/state";

export default function RecoverRoute() {
  const router = useRouter();
  const { session } = useSession();
  return (
    <StartRecoveryScreen
      onBack={() => router.back()}
      onSubmit={async (email) => {
        await session.startRecovery(email);
        router.push(afterRecover());
      }}
      onSignIn={() => router.push(AUTH_ROUTES.signIn)}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
