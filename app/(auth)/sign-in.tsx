import { Redirect, useRouter } from "expo-router";
import { afterSignIn, AUTH_ROUTES, SignInScreen } from "../../src/features/auth-onboarding";
import { UnverifiedEmailError } from "../../src/lib/session-core";
import { useSession } from "../../src/state";

export default function SignInRoute() {
  const router = useRouter();
  const { session, status } = useSession();
  if (status === "signedIn") return <Redirect href={AUTH_ROUTES.home} />;
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
