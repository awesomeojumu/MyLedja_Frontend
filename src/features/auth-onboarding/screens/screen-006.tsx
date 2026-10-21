import { RecoveryResetScreen } from "@/features/auth-onboarding/screens/RecoveryResetScreen";

export function Screen006() {
  return (
    <RecoveryResetScreen
      email={null}
      onBack={() => undefined}
      onSubmit={async () => undefined}
      onResend={async () => undefined}
      onCreateAccount={() => undefined}
    />
  );
}
