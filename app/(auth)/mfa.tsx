import { useLocalSearchParams, useRouter } from "expo-router";
import { afterMfa, AUTH_ROUTES, MfaScreen } from "@/features/auth-onboarding";
import { useSession } from "@/state";

export default function MfaRoute() {
  const router = useRouter();
  const { session } = useSession();
  const { challengeId } = useLocalSearchParams<{ challengeId?: string }>();
  return (
    <MfaScreen
      onBack={() => router.back()}
      onSubmit={async (input) => {
        await session.completeMfa({ challengeId: String(challengeId ?? ""), ...input });
        router.replace(afterMfa());
      }}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
