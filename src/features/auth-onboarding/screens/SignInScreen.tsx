import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "@/design";
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
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();
  const ready = canSubmitSignIn(identifier, password);
  const createAccount = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4 }}>
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
      <View accessibilityLabel="Sign in" style={{ gap: t.space.space4 }}>
        <TextField
          label="Email"
          icon="mail"
          placeholder="you@email.com"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <View style={{ gap: 8 }}>
          <TextField label="Password" value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="current-password" secureTextEntry />
          <View style={{ alignItems: "flex-end" }}>
            <TextLink onPress={onForgot}>Forgot password?</TextLink>
          </View>
        </View>
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
      </View>
    </AuthShell>
  );
}
