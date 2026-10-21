import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, SegmentedControl, TextField, Txt, useTheme } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { PasswordRules } from "@/features/auth-onboarding/components/PasswordRules";
import { TextLink } from "@/features/auth-onboarding/components/TextLink";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { canCreateAccount, rememberSignup } from "@/features/auth-onboarding/services/auth-flow";
import { passwordRules } from "@/features/auth-onboarding/services/password-rules";

export function CreateAccountScreen({
  onBack,
  onSignIn,
  onSubmit,
}: {
  onBack: () => void;
  onSignIn: () => void;
  onSubmit: (input: { email: string; password: string }) => Promise<void>;
}) {
  const t = useTheme();
  const [channel, setChannel] = useState("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();
  const rules = passwordRules(password, name, email);
  const byPhone = channel === "phone";
  const ready = !byPhone && email.includes("@") && canCreateAccount(rules);
  return (
    <AuthShell
      step={{ label: "Create account", current: 1, total: 4 }}
      onBack={onBack}
      topRight={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Txt variant="caption" color={t.c.inkMuted}>
            Have an account?
          </Txt>
          <TextLink onPress={onSignIn}>Sign in</TextLink>
        </View>
      }
      title="Create your account"
      subtitle="It takes about a minute."
      footer={
        <View style={{ gap: t.space.space3 }}>
          <Button
            fullWidth
            size="lg"
            loading={busy}
            disabled={!ready}
            disabledReason={byPhone ? "Phone sign-up is coming soon. Use your email for now." : undefined}
            onPress={() =>
              run(async () => {
                rememberSignup(name, email);
                await onSubmit({ email, password });
              })
            }
          >
            Create account
          </Button>
          <Txt variant="caption" color={t.c.inkMuted} style={{ textAlign: "center" }}>
            Next, we’ll email you a 6-digit code.
          </Txt>
        </View>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <SegmentedControl
        label="Sign up with"
        options={[
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone number" },
        ]}
        value={channel}
        onChange={setChannel}
      />
      <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      {byPhone ? (
        <Banner tone="primary" title="Phone sign-up is coming soon">
          Use your email address for now.
        </Banner>
      ) : (
        <TextField label="Email address" icon="mail" placeholder="you@email.com" autoComplete="email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      )}
      <TextField label="Password" autoComplete="new-password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
      <PasswordRules rules={rules} />
    </AuthShell>
  );
}
