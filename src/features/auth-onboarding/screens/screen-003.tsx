import { VerifyIdentityScreen } from "@/features/auth-onboarding/screens/VerifyIdentityScreen";

export function Screen003() {
  return (
    <VerifyIdentityScreen
      email={null}
      onBack={() => undefined}
      onSignIn={() => undefined}
      onChangeEmail={() => undefined}
      onSubmit={async () => undefined}
      onResend={async () => undefined}
    />
  );
}
