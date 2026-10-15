import { useRouter } from "expo-router";
import { afterSignIn, AUTH_ROUTES, SignInScreen } from "../../src/features/auth-onboarding";

export default function SignInRoute() {
  const router = useRouter();
  return (
    <SignInScreen
      onBack={() => router.back()}
      onSubmit={() => router.push(afterSignIn())}
      onPasskey={() => router.push(afterSignIn())}
      onForgot={() => router.push(AUTH_ROUTES.recover)}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
