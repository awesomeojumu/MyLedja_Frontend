import { Redirect, useRouter } from "expo-router";
import { AUTH_ROUTES, WelcomeScreen } from "@/features/auth-onboarding";
import { useSession } from "@/state";

export default function WelcomeRoute() {
  const router = useRouter();
  const { status } = useSession();
  if (status === "loading") return null;
  if (status === "signedIn") return <Redirect href={AUTH_ROUTES.splash} />;
  return <WelcomeScreen onSignIn={() => router.push(AUTH_ROUTES.signIn)} onSignUp={() => router.push(AUTH_ROUTES.signUp)} />;
}
