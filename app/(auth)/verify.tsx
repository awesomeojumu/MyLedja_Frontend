import { useRouter } from "expo-router";
import { afterVerify, AUTH_ROUTES, VerifyIdentityScreen } from "../../src/features/auth-onboarding";

export default function VerifyRoute() {
  const router = useRouter();
  return (
    <VerifyIdentityScreen
      onBack={() => router.back()}
      onSignIn={() => router.push(AUTH_ROUTES.signIn)}
      onChangeEmail={() => router.back()}
      onSubmit={() => router.push(afterVerify())}
    />
  );
}
