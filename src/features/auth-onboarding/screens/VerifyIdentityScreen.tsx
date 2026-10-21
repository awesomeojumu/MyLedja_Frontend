import { useEffect, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Txt, useTheme } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { OtpBoxes } from "@/features/auth-onboarding/components/OtpBoxes";
import { TextLink } from "@/features/auth-onboarding/components/TextLink";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { canVerifyOtp, maskEmail } from "@/features/auth-onboarding/services/auth-flow";

export function VerifyIdentityScreen({
  email,
  onBack,
  onSignIn,
  onChangeEmail,
  onSubmit,
  onResend,
}: {
  email: string | null;
  onBack: () => void;
  onSignIn: () => void;
  onChangeEmail: () => void;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}) {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(60);
  const [resent, setResent] = useState(false);
  const { busy, error, run } = useSubmit();
  const ready = !!email && canVerifyOtp(code);
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
      icon="mail"
      title="Check your email"
      subtitle={
        email
          ? `Enter the 6-digit code we sent to ${maskEmail(email)}. It expires in 10 minutes.`
          : "Start from sign up or sign in so we know where to send your code."
      }
      hint={ready ? undefined : "Enter all 6 digits"}
      footer={
        <Button fullWidth size="lg" loading={busy} disabled={!ready} onPress={() => run(() => onSubmit(code))}>
          Verify
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      {resent && !error ? <Banner tone="primary" title="We sent a new code." /> : null}
      <OtpBoxes value={code} onChange={setCode} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {seconds > 0 ? (
          <Txt variant="caption" color={t.c.inkMuted}>
            Resend code in {mm}
          </Txt>
        ) : (
          <TextLink
            onPress={() =>
              run(async () => {
                await onResend();
                setResent(true);
                setCode("");
                setSeconds(60);
              })
            }
          >
            Resend code
          </TextLink>
        )}
        <TextLink onPress={onChangeEmail}>Change email</TextLink>
      </View>
    </AuthShell>
  );
}
