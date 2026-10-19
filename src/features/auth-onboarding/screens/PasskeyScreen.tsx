import { Platform, View } from "react-native";
import { Banner, Button, Icon, Txt, useTheme } from "@/design";
import { PASSKEY_POINTS } from "@/features/auth-onboarding/auth-copy";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";

export function PasskeyScreen({
  onCreate,
  onSkip,
}: {
  onCreate: () => Promise<void>;
  onSkip: () => void;
}) {
  const t = useTheme();
  const { busy, error, run } = useSubmit();
  const native = Platform.OS !== "web";
  return (
    <AuthShell
      step={{ label: "Create account", current: 4, total: 4 }}
      footer={
        <View style={{ gap: t.space.space3 }}>
          <Button
            fullWidth
            size="lg"
            icon="shield-check"
            loading={busy}
            disabled={native}
            onPress={() => run(onCreate)}
          >
            Create passkey
          </Button>
          <Button variant="tertiary" fullWidth onPress={onSkip}>
            Not now
          </Button>
        </View>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      {native ? (
        <Banner tone="primary" title="Passkeys on this device">
          Use a browser that supports passkeys.
        </Banner>
      ) : null}
      <View style={{ alignItems: "center", gap: t.space.space4 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: t.radius.radiusLg,
            backgroundColor: t.c.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="shield-check" size={32} color={t.c.primary} />
        </View>
        <View style={{ gap: 8, alignItems: "center" }}>
          <Txt variant="titleLg" accessibilityRole="header" style={{ textAlign: "center" }}>
            Sign in faster with a passkey
          </Txt>
          <Txt color={t.c.inkMuted} style={{ textAlign: "center" }}>
            Use your fingerprint, face or screen lock instead of typing a password. Nothing to remember, nothing to leak.
          </Txt>
        </View>
      </View>
      <View style={{ backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.radiusLg, padding: t.space.space4, gap: t.space.space3 }}>
        {PASSKEY_POINTS.map((line) => (
          <View key={line} style={{ flexDirection: "row", alignItems: "flex-start", gap: t.space.space3 }}>
            <Icon name="circle-check" size={18} color={t.c.positive} />
            <Txt style={{ flex: 1 }}>{line}</Txt>
          </View>
        ))}
      </View>
    </AuthShell>
  );
}
