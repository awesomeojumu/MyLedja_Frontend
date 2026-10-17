import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "@/design";
import { splitLayout } from "@/lib";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { TextLink } from "@/features/auth-onboarding/components/TextLink";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { canSubmitSignIn, rememberSignup } from "@/features/auth-onboarding/services/auth-flow";

export function SignInScreen({
  onBack,
  onSubmit,
  onForgot,
  onCreateAccount,
}: {
  onBack: () => void;
  onSubmit: (input: { email: string; password: string }) => Promise<void>;
  onForgot: () => void;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const compact = !splitLayout(t.widthClass, t.portrait);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passkeyNotice, setPasskeyNotice] = useState(false);
  const { busy, error, run } = useSubmit();
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
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      {passkeyNotice ? (
        <Banner tone="primary" title="Passkeys are coming soon">
          Sign in with your email and password for now.
        </Banner>
      ) : null}
      <View accessibilityLabel="Sign in">
      <TextField label="Email address" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType="email-address" />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt variant="label">Password</Txt>
          <TextLink onPress={onForgot}>Forgot password?</TextLink>
        </View>
        <TextField placeholder="Password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
      </View>
      <View style={{ gap: t.space.space4 }}>
        <Button
          fullWidth
          size="lg"
          loading={busy}
          disabled={!ready}
          onPress={() =>
            run(async () => {
              rememberSignup("", identifier);
              await onSubmit({ email: identifier, password });
            })
          }
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
        <Button fullWidth size="lg" variant="secondary" icon="shield-check" onPress={() => setPasskeyNotice(true)}>
          Sign in with a passkey
        </Button>
        {compact ? createAccount : null}
      </View>
      </View>
    </AuthShell>
  );
}
