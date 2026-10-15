import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "../../../design";
import { AuthShell } from "../components/AuthShell";
import { OtpBoxes } from "../components/OtpBoxes";
import { PasswordRules } from "../components/PasswordRules";
import { TextLink } from "../components/TextLink";
import { canSaveNewPassword, maskEmail, rememberedSignup } from "../services/auth-flow";
import { passwordRules } from "../services/password-rules";

export function RecoveryResetScreen({
  onBack,
  onSubmit,
  onCreateAccount,
}: {
  onBack: () => void;
  onSubmit: () => void;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const remembered = rememberedSignup();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const rules = passwordRules(password, remembered.name, remembered.email);
  const ready = canSaveNewPassword(code, rules);
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
      subtitle={`Enter the code we sent to ${maskEmail(remembered.email)}, then your new password.`}
      hint={ready ? undefined : "Your password needs all three checks"}
      footer={
        <Button fullWidth size="lg" disabled={!ready} onPress={onSubmit}>
          Save new password
        </Button>
      }
    >
      <View style={{ gap: 8 }}>
        <Txt variant="label">Code</Txt>
        <OtpBoxes value={code} onChange={setCode} />
      </View>
      <TextField label="New password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
      <PasswordRules rules={rules} />
      <Banner tone="primary" title="You’ll be signed out on every other device." />
    </AuthShell>
  );
}
