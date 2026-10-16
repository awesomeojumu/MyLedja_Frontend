import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "../../../design";
import { AuthShell } from "../components/AuthShell";
import { OtpBoxes } from "../components/OtpBoxes";
import { PasswordRules } from "../components/PasswordRules";
import { TextLink } from "../components/TextLink";
import { useSubmit } from "../hooks/use-submit";
import { canSaveNewPassword, maskEmail } from "../services/auth-flow";
import { passwordRules } from "../services/password-rules";

export function RecoveryResetScreen({
  email,
  onBack,
  onSubmit,
  onCreateAccount,
}: {
  email: string | null;
  onBack: () => void;
  onSubmit: (input: { code: string; password: string }) => Promise<void>;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();
  const rules = passwordRules(password, "", email ?? "");
  const ready = !!email && canSaveNewPassword(code, rules);
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
      title="Choose a new password"
      subtitle={
        email
          ? `Enter the code we sent to ${maskEmail(email)}, then your new password.`
          : "Go back and enter your email first."
      }
      hint={ready ? undefined : "Your password needs all three checks"}
      footer={
        <Button fullWidth size="lg" loading={busy} disabled={!ready} onPress={() => run(() => onSubmit({ code, password }))}>
          Save new password
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <View style={{ gap: 8 }}>
        <Txt variant="label">Code</Txt>
        <OtpBoxes value={code} onChange={setCode} />
      </View>
      <TextField label="New password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
      <PasswordRules rules={rules} />
      <Banner tone="primary" title="You’ll be signed out on every device." />
    </AuthShell>
  );
}
