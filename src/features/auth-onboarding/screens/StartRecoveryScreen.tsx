import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { TextLink } from "@/features/auth-onboarding/components/TextLink";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { rememberSignup } from "@/features/auth-onboarding/services/auth-flow";

export function StartRecoveryScreen({
  onBack,
  onSubmit,
  onSignIn,
  onCreateAccount,
}: {
  onBack: () => void;
  onSubmit: (email: string) => Promise<void>;
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const [identifier, setIdentifier] = useState("");
  const { busy, error, run } = useSubmit();
  const looksLikeEmail = identifier.trim().length > 3 && identifier.includes("@");
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
      icon="mail"
      title="Reset your password"
      subtitle="Enter the email on your account and we’ll send you a code."
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <TextField label="Email address" icon="mail" placeholder="you@email.com" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType="email-address" />
      <View style={{ gap: t.space.space3, alignItems: "stretch" }}>
        <Button
          fullWidth
          size="lg"
          loading={busy}
          disabled={!looksLikeEmail}
          onPress={() =>
            run(async () => {
              rememberSignup("", identifier);
              await onSubmit(identifier);
            })
          }
        >
          Send code
        </Button>
        <View style={{ alignItems: "center" }}>
          <TextLink onPress={onSignIn}>Back to sign in</TextLink>
        </View>
      </View>
      <Banner tone="primary" title="Codes can take a minute">
        Check your spam folder if it doesn’t show up.
      </Banner>
    </AuthShell>
  );
}
