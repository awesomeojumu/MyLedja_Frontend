import { useRouter } from "expo-router";
import { afterSignUp, AUTH_ROUTES, CreateAccountScreen } from "../../src/features/auth-onboarding";

export default function CreateAccountRoute() {
  const router = useRouter();
  return (
    <CreateAccountScreen
      onBack={() => router.back()}
      onSignIn={() => router.push(AUTH_ROUTES.signIn)}
      onSubmit={() => router.push(afterSignUp())}
    />
  );
}
