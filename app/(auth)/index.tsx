import { useRouter } from "expo-router";
import { AUTH_ROUTES, WelcomeScreen } from "../../src/features/auth-onboarding";

export default function WelcomeRoute() {
  const router = useRouter();
  return <WelcomeScreen onSignIn={() => router.push(AUTH_ROUTES.signIn)} onSignUp={() => router.push(AUTH_ROUTES.signUp)} />;
}
