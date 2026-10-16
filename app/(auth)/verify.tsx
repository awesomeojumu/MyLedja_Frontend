import { useRouter } from "expo-router";
import { afterVerify, AUTH_ROUTES, VerifyIdentityScreen } from "../../src/features/auth-onboarding";
import { useSession } from "../../src/state";

export default function VerifyRoute() {
  const router = useRouter();
  const { session, pendingEmail } = useSession();
  return (
    <VerifyIdentityScreen
      email={pendingEmail}
      onBack={() => router.back()}
      onSignIn={() => router.push(AUTH_ROUTES.signIn)}
      onChangeEmail={() => router.replace(AUTH_ROUTES.signUp)}
      onResend={() => session.resendVerification()}
      onSubmit={async (code) => {
        const outcome = await session.verify(code);
        router.replace(outcome === "signedIn" ? afterVerify() : AUTH_ROUTES.signIn);
      }}
    />
  );
}
