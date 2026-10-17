import { useRouter } from "expo-router";
import { afterSignUp, AUTH_ROUTES, CreateAccountScreen } from "@/features/auth-onboarding";
import { useSession } from "@/state";

export default function CreateAccountRoute() {
  const router = useRouter();
  const { session } = useSession();
  return (
    <CreateAccountScreen
      onBack={() => router.back()}
      onSignIn={() => router.push(AUTH_ROUTES.signIn)}
      onSubmit={async ({ email, password }) => {
        await session.register(email, password);
        router.push(afterSignUp());
      }}
    />
  );
}
