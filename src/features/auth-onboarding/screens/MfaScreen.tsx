import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, Txt, useTheme } from "../../../design";
import { AuthShell } from "../components/AuthShell";
import { OtpBoxes } from "../components/OtpBoxes";
import { TextLink } from "../components/TextLink";
import { canVerifyOtp } from "../services/auth-flow";

export function MfaScreen({
  onBack,
  onSubmit,
  onCreateAccount,
}: {
  onBack: () => void;
  onSubmit: () => void;
  onCreateAccount: () => void;
}) {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [lost, setLost] = useState(false);
  const ready = canVerifyOtp(code);
  return (
    <AuthShell
      brand="welcomeBack"
      onBack={onBack}
      topRight={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Txt variant="caption" color={t.c.inkMuted}>
            New to MyLedja?
          </Txt>
          <TextLink onPress={onCreateAccount}>Create account</TextLink>
        </View>
      }
      title="Enter your security code"
      subtitle={
        backup
          ? "Type one of the backup codes you saved when you turned this on."
          : "Open your authenticator app and type the 6-digit code it shows for MyLedja."
      }
      hint={ready ? undefined : "Enter all 6 digits"}
      footer={
        <Button
          fullWidth
          size="lg"
          disabled={!ready}
          onPress={() => {
            if (canVerifyOtp(code)) onSubmit();
          }}
        >
          Verify and sign in
        </Button>
      }
    >
      <OtpBoxes value={code} onChange={setCode} />
      <View style={{ gap: t.space.space3 }}>
        <TextLink onPress={() => setBackup((v) => !v)}>{backup ? "Use authenticator code instead" : "Use a backup code instead"}</TextLink>
        <TextLink onPress={() => setLost(true)}>Lost access to your app?</TextLink>
      </View>
      {lost ? (
        <Banner tone="primary" title="Dummy recovery">
          Real authenticator recovery is not wired yet. Enter any 6 digits to continue.
        </Banner>
      ) : null}
    </AuthShell>
  );
}
