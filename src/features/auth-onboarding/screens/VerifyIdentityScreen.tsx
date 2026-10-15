import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Txt, useTheme } from "../../../design";
import { AuthShell } from "../components/AuthShell";
import { OtpBoxes } from "../components/OtpBoxes";
import { TextLink } from "../components/TextLink";
import { canVerifyOtp, dummyOtpAccepts, maskEmail, rememberedSignup } from "../services/auth-flow";

export function VerifyIdentityScreen({
  onBack,
  onSignIn,
  onChangeEmail,
  onSubmit,
}: {
  onBack: () => void;
  onSignIn: () => void;
  onChangeEmail: () => void;
  onSubmit: () => void;
}) {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(60);
  const ready = canVerifyOtp(code);
  const masked = maskEmail(rememberedSignup().email);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <AuthShell
      step={{ label: "Create account", current: 2, total: 4 }}
      onBack={onBack}
      topRight={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Txt variant="caption" color={t.c.inkMuted}>
            Have an account?
          </Txt>
          <TextLink onPress={onSignIn}>Sign in</TextLink>
        </View>
      }
      title="Check your email"
      subtitle={`Enter the 6-digit code we sent to ${masked}. It expires in 10 minutes.`}
      hint={ready ? undefined : "Enter all 6 digits"}
      footer={
        <Button
          fullWidth
          size="lg"
          disabled={!ready}
          onPress={() => {
            if (dummyOtpAccepts(code)) onSubmit();
          }}
        >
          Verify
        </Button>
      }
    >
      <OtpBoxes value={code} onChange={setCode} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {seconds > 0 ? (
          <Txt variant="caption" color={t.c.inkMuted}>
            Resend code in {mm}
          </Txt>
        ) : (
          <TextLink onPress={() => setSeconds(60)}>Resend code</TextLink>
        )}
        <TextLink onPress={onChangeEmail}>Change email</TextLink>
      </View>
    </AuthShell>
  );
}
