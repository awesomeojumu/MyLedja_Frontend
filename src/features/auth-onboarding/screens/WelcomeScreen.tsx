import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, Logo, LogoMark, TransactionRow, Txt, useTheme } from "@/design";
import { splitLayout } from "@/lib";
import { WELCOME_PREVIEW } from "@/features/auth-onboarding/auth-copy";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";

function PreviewCard() {
  const t = useTheme();
  return (
    <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
      {WELCOME_PREVIEW.map((row) => (
        <TransactionRow
          key={row.title}
          title={row.title}
          category={row.category}
          account={row.method}
          amount={Math.abs(row.amount)}
          kind={row.amount > 0 ? "income" : "expense"}
          time={row.time}
        />
      ))}
    </View>
  );
}

function Actions({ onSignUp, onSignIn }: { onSignUp: () => void; onSignIn: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.space3 }}>
      <Button fullWidth size="lg" onPress={onSignUp}>
        Create account
      </Button>
      <Button fullWidth size="lg" variant="secondary" onPress={onSignIn}>
        Sign in
      </Button>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Icon name="shield-check" size={14} color={t.c.inkMuted} />
        <Txt variant="caption" color={t.c.inkMuted}>
          We never ask for your bank password.
        </Txt>
      </View>
    </View>
  );
}

export function WelcomeScreen({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (splitLayout(t.widthClass, t.portrait)) {
    return (
      <AuthShell>
        <View style={{ gap: t.space.space5, alignItems: "stretch" }}>
          <LogoMark size={48} />
          <View style={{ gap: 8 }}>
            <Txt variant="titleLg" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 38 }}>
              Know where every naira goes.
            </Txt>
            <Txt color={t.c.inkMuted}>Record cash, transfers and bills in seconds. Works offline and stays exact to the kobo.</Txt>
          </View>
          <Actions onSignUp={onSignUp} onSignIn={onSignIn} />
        </View>
      </AuthShell>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + t.space.space4, paddingHorizontal: t.space.space5, paddingBottom: Math.max(insets.bottom, t.space.space5), gap: t.space.space6 }}>
      <Logo size={32} />
      <View style={{ flex: 1, justifyContent: "center", gap: t.space.space6 }}>
        <PreviewCard />
        <View style={{ gap: 8 }}>
          <Txt variant="titleLg" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 38 }}>
            Know where every naira goes.
          </Txt>
          <Txt color={t.c.inkMuted}>Record cash, transfers and bills in seconds. Works offline and stays exact to the kobo.</Txt>
        </View>
      </View>
      <Actions onSignUp={onSignUp} onSignIn={onSignIn} />
    </View>
  );
}
