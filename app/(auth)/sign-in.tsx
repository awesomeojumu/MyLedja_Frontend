import { Redirect, useRouter } from "expo-router";
import { afterSignIn, AUTH_ROUTES, SignInScreen } from "@/features/auth-onboarding";
import { UnverifiedEmailError } from "@/lib/session-core";
import { useSession } from "@/state";

export default function SignInRoute() {
  const router = useRouter();
  const { session, status } = useSession();
  if (status === "signedIn") return <Redirect href={AUTH_ROUTES.splash} />;
  return (
    <SignInScreen
      onBack={() => router.back()}
      onSubmit={async ({ email, password }) => {
        try {
          await session.signIn(email, password);
          router.replace(afterSignIn());
        } catch (error) {
          if (error instanceof UnverifiedEmailError) {
            router.push(AUTH_ROUTES.verify);
            return;
          }
          throw error;
        }
      }}
      onForgot={() => router.push(AUTH_ROUTES.recover)}
      onCreateAccount={() => router.push(AUTH_ROUTES.signUp)}
    />
  );
}
