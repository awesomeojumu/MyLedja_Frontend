import { useState } from "react";
import { View } from "react-native";
import { Button, TextField, Txt, useTheme } from "../../../design";
import { splitLayout } from "../../../lib";
import { AuthShell } from "../components/AuthShell";
import { TextLink } from "../components/TextLink";
import { canSubmitSignIn, rememberSignup } from "../services/auth-flow";

export function SignInScreen({
  onBack,
  onSubmit,
  onPasskey,
  onForgot,
  onCreateAccount,
}: {
  onBack: () => void;
  onSubmit: () => void;
  onPasskey: () => void;
  onForgot: () => void;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const compact = !splitLayout(t.widthClass, t.portrait);
  const [identifier, setIdentifier] = useState("adaeze@example.com");
  const [password, setPassword] = useState("");
  const ready = canSubmitSignIn(identifier, password);
  const createAccount = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
      <Txt variant="caption" color={t.c.inkMuted}>
        New to MyLedja?
      </Txt>
      <TextLink onPress={onCreateAccount}>Create account</TextLink>
    </View>
  );
  return (
    <AuthShell
      brand="welcomeBack"
      onBack={onBack}
      topRight={createAccount}
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <View style={{ gap: t.space.space4 }}>
          <Button
            fullWidth
            size="lg"
            disabled={!ready}
            onPress={() => {
              rememberSignup("", identifier);
              onSubmit();
            }}
          >
            Sign in
          </Button>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.c.border }} />
            <Txt variant="caption" color={t.c.inkMuted}>
              or
            </Txt>
            <View style={{ flex: 1, height: 1, backgroundColor: t.c.border }} />
          </View>
          <Button fullWidth size="lg" variant="secondary" icon="shield-check" onPress={onPasskey}>
            Sign in with a passkey
          </Button>
          {compact ? createAccount : null}
        </View>
      }
    >
      <TextField label="Email or phone number" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType="email-address" />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt variant="label">Password</Txt>
          <TextLink onPress={onForgot}>Forgot password?</TextLink>
        </View>
        <TextField placeholder="Password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
      </View>
    </AuthShell>
  );
}
