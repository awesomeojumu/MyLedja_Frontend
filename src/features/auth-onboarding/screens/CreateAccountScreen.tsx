import { useState } from "react";
import { View } from "react-native";
import { Button, SegmentedControl, TextField, Txt, useTheme } from "../../../design";
import { AuthShell } from "../components/AuthShell";
import { PasswordRules } from "../components/PasswordRules";
import { TextLink } from "../components/TextLink";
import { canCreateAccount, rememberSignup } from "../services/auth-flow";
import { passwordRules } from "../services/password-rules";

export function CreateAccountScreen({
  onBack,
  onSignIn,
  onSubmit,
}: {
  onBack: () => void;
  onSignIn: () => void;
  onSubmit: () => void;
}) {
  const t = useTheme();
  const [channel, setChannel] = useState("email");
  const [name, setName] = useState("Adaeze Okafor");
  const [email, setEmail] = useState("adaeze@example.com");
  const [password, setPassword] = useState("");
  const rules = passwordRules(password, name, email);
  const ready = canCreateAccount(rules);
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
            disabled={!ready}
            onPress={() => {
              rememberSignup(name, email);
              onSubmit();
            }}
          >
            Create account
          </Button>
          <Txt variant="caption" color={t.c.inkMuted} style={{ textAlign: "center" }}>
            Next, you’ll review our Terms and Privacy Policy.
          </Txt>
        </View>
      }
    >
      <SegmentedControl
        label="Sign up with"
        options={[
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone number" },
        ]}
        value={channel}
        onChange={setChannel}
      />
      <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      {channel === "email" ? (
        <TextField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      ) : (
        <TextField label="Phone number" placeholder="0803 000 0000" keyboardType="phone-pad" autoCapitalize="none" />
      )}
      <TextField label="Password" value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
      <PasswordRules rules={rules} />
    </AuthShell>
  );
}
