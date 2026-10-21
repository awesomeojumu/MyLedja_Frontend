import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Icon, Sheet, Txt, useTheme } from "@/design";
import { TERMS_POINTS } from "@/features/auth-onboarding/auth-copy";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { CheckboxRow } from "@/features/auth-onboarding/components/CheckboxRow";
import { canAgreeToTerms } from "@/features/auth-onboarding/services/auth-flow";

export function TermsPrivacyScreen({ onBack, onSubmit }: { onBack: () => void; onSubmit: () => void }) {
  const t = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [tips, setTips] = useState(false);
  const [doc, setDoc] = useState<"terms" | "privacy" | null>(null);
  const ready = canAgreeToTerms(agreed);
  return (
    <AuthShell
      step={{ label: "Create account", current: 3, total: 4 }}
      onBack={onBack}
      icon="shield-check"
      title="Before you start"
      subtitle="The short version of how we treat your money and your data."
      hint={ready ? undefined : "Tick the first box to continue"}
      footer={
        <Button fullWidth size="lg" disabled={!ready} onPress={onSubmit}>
          Agree and continue
        </Button>
      }
    >
      <View style={{ gap: t.space.space4 }}>
        {TERMS_POINTS.map((item) => (
          <View key={item.title} style={{ flexDirection: "row", alignItems: "flex-start", gap: t.space.space3 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: t.radius.radiusMd,
                backgroundColor: t.c.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={item.icon} size={18} color={t.c.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label" style={{ fontWeight: "600" }}>
                {item.title}
              </Txt>
              <Txt variant="caption" color={t.c.inkMuted}>
                {item.body}
              </Txt>
            </View>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
        <DocRow title="Terms of Service" onPress={() => setDoc("terms")} last={false} />
        <DocRow title="Privacy Policy" onPress={() => setDoc("privacy")} last />
      </View>
      <View style={{ gap: t.space.space3 }}>
        <CheckboxRow checked={agreed} onChange={setAgreed}>
          I have read and agree to the Terms of Service and Privacy Policy.
        </CheckboxRow>
        <CheckboxRow checked={tips} onChange={setTips}>
          Send me tips and product news by email (optional).
        </CheckboxRow>
      </View>
      <Sheet title={doc === "privacy" ? "Privacy Policy" : "Terms of Service"} open={!!doc} onClose={() => setDoc(null)}>
        <Txt color={t.c.inkMuted}>
          Version 1.0. Full legal copy is not in this pass. MyLedja never asks for bank logins, PINs or OTPs. You can export or delete
          your records from Settings.
        </Txt>
      </Sheet>
    </AuthShell>
  );
}

function DocRow({ title, onPress, last }: { title: string; onPress: () => void; last: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, Version 1.0`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 64,
        paddingHorizontal: t.space.space4,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.c.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="label" style={{ fontWeight: "600" }}>
          {title}
        </Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          Version 1.0
        </Txt>
      </View>
      <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
    </Pressable>
  );
}
