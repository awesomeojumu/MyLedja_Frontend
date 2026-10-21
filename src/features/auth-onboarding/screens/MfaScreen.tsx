import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, Txt, useTheme } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { OtpBoxes } from "@/features/auth-onboarding/components/OtpBoxes";
import { TextLink } from "@/features/auth-onboarding/components/TextLink";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { canVerifyOtp } from "@/features/auth-onboarding/services/auth-flow";

export function MfaScreen({
  onBack,
  onSubmit,
  onCreateAccount,
}: {
  onBack: () => void;
  onSubmit: (input: { code?: string; backupCode?: string }) => Promise<void>;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [lost, setLost] = useState(false);
  const { busy, error, run } = useSubmit();
  const ready = canVerifyOtp(code);
  return (
    <AuthShell
      brand="welcomeBack"
      onBack={onBack}
      topRight={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Txt variant="caption" color={t.c.inkMuted}>
            New to MyLedja?
          </Txt>
          <TextLink onPress={onCreateAccount}>Create account</TextLink>
        </View>
      }
      icon="smartphone"
      title="Enter your security code"
      subtitle={
        backup
          ? "Type one of the backup codes you saved when you turned this on."
          : "Open your authenticator app and type the 6-digit code it shows for MyLedja."
      }
      hint={ready ? undefined : "Enter all 6 digits"}
      footer={
        <Button
          fullWidth
          size="lg"
          loading={busy}
          disabled={!ready}
          onPress={() =>
            run(async () => {
              if (!canVerifyOtp(code)) return;
              await onSubmit(backup ? { backupCode: code } : { code });
            })
          }
        >
          Verify and sign in
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <OtpBoxes value={code} onChange={setCode} />
      <View style={{ gap: t.space.space3 }}>
        <TextLink onPress={() => setBackup((v) => !v)}>{backup ? "Use authenticator code instead" : "Use a backup code instead"}</TextLink>
        <TextLink onPress={() => setLost(true)}>Lost access to your app?</TextLink>
      </View>
      {lost ? (
        <Banner tone="primary" title="Authenticator recovery">
          Use a backup code, or reset from the email you used to sign up.
        </Banner>
      ) : null}
    </AuthShell>
  );
}
