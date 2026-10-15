import { View } from "react-native";
import { Button, Icon, Txt, useTheme } from "../../../design";
import { PASSKEY_POINTS } from "../auth-copy";
import { AuthShell } from "../components/AuthShell";

export function PasskeyScreen({ onContinue }: { onContinue: () => void }) {
  const t = useTheme();
  return (
    <AuthShell
      step={{ label: "Create account", current: 4, total: 4 }}
      footer={
        <View style={{ gap: t.space.space3 }}>
          <Button fullWidth size="lg" icon="shield-check" onPress={onContinue}>
            Create passkey
          </Button>
          <Button variant="tertiary" fullWidth onPress={onContinue}>
            Not now
          </Button>
        </View>
      }
    >
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
