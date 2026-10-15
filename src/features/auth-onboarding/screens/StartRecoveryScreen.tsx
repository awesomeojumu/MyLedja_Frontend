import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "../../../design";
import { AuthShell } from "../components/AuthShell";
import { TextLink } from "../components/TextLink";
import { maskEmail, rememberSignup } from "../services/auth-flow";

export function StartRecoveryScreen({
  onBack,
  onSubmit,
  onSignIn,
  onCreateAccount,
}: {
  onBack: () => void;
  onSubmit: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const [identifier, setIdentifier] = useState("adaeze@example.com");
  const looksLikeId = identifier.trim().length > 3;
  const masked = maskEmail(identifier.includes("@") ? identifier : `${identifier[0] ?? "a"}@example.com`);
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
      title="Reset your password"
      subtitle="Enter the email or phone number on your account and we’ll send you a code."
      footer={
        <View style={{ gap: t.space.space3, alignItems: "stretch" }}>
          <Button
            fullWidth
            size="lg"
            disabled={!looksLikeId}
            onPress={() => {
              rememberSignup("", identifier);
              onSubmit();
            }}
          >
            Enter the code
          </Button>
          <View style={{ alignItems: "center" }}>
            <TextLink onPress={onSignIn}>Back to sign in</TextLink>
          </View>
        </View>
      }
    >
      <TextField label="Email or phone number" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType="email-address" />
      {looksLikeId ? (
        <Banner tone="primary" title="Check your inbox">
          If an account matches {masked}, a code is on its way. It can take a minute.
        </Banner>
      ) : null}
    </AuthShell>
  );
}
