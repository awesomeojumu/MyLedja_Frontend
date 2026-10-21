import { useEffect, useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { OtpBoxes } from "@/features/auth-onboarding/components/OtpBoxes";
import { PasswordRules } from "@/features/auth-onboarding/components/PasswordRules";
import { TextLink } from "@/features/auth-onboarding/components/TextLink";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { canSaveNewPassword, maskEmail } from "@/features/auth-onboarding/services/auth-flow";
import { passwordRules } from "@/features/auth-onboarding/services/password-rules";

export function RecoveryResetScreen({
  email,
  onBack,
  onSubmit,
  onResend,
  onCreateAccount,
}: {
  email: string | null;
  onBack: () => void;
  onSubmit: (input: { code: string; password: string }) => Promise<void>;
  onResend: () => Promise<void>;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [seconds, setSeconds] = useState(60);
  const [resent, setResent] = useState(false);
  const { busy, error, run } = useSubmit();
  const rules = passwordRules(password, "", email ?? "");
  const ready = !!email && canSaveNewPassword(code, rules);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <AuthShell
      brand="recovery"
      onBack={onBack}
      topRight={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Txt variant="caption" color={t.c.inkMuted}>
            New to MyLedja?
          </Txt>
          <TextLink onPress={onCreateAccount}>Create account</TextLink>
        </View>
      }
      icon="shield-check"
      title="Choose a new password"
      subtitle={
        email
          ? `Enter the code we sent to ${maskEmail(email)}, then your new password.`
          : "Go back and enter your email first."
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      {resent && !error ? <Banner tone="primary" title="We sent a new code." /> : null}
      <View style={{ gap: 8 }}>
        <Txt variant="label">Code</Txt>
        <OtpBoxes value={code} onChange={setCode} />
        {email ? (
          seconds > 0 ? (
            <Txt variant="caption" color={t.c.inkMuted}>
              Resend code in {mm}
            </Txt>
          ) : (
            <View style={{ alignItems: "flex-start" }}>
              <TextLink
                onPress={() =>
                  run(async () => {
                    await onResend();
                    setResent(true);
                    setCode("");
                    setSeconds(60);
                  })
                }
              >
                Resend code
              </TextLink>
            </View>
          )
        ) : null}
      </View>
      <TextField label="New password" autoComplete="new-password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
      <PasswordRules rules={rules} />
      <Button fullWidth size="lg" loading={busy} disabled={!ready} onPress={() => run(() => onSubmit({ code, password }))}>
        Save new password
      </Button>
      <Banner tone="primary" title="You’ll be signed out on every device." />
    </AuthShell>
  );
}
