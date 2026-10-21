import { View } from "react-native";
import { Logo, Txt, formatMoney, useTheme } from "@/design";
import { BRAND, TRUST_BULLETS, WELCOME_PREVIEW, type BrandKind } from "@/features/auth-onboarding/auth-copy";

export type { BrandKind };

/** Wide-screen left pane: the headline, a sample of what the app looks like, and the trust promises in one line. */
export function BrandPane({ kind = "default" }: { kind?: BrandKind }) {
  const t = useTheme();
  const copy = BRAND[kind];
  return (
    <View style={{ flex: 2, backgroundColor: t.c.hero, padding: t.space.space8, justifyContent: "space-between", overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", width: 360, height: 360, borderRadius: 999, backgroundColor: t.c.heroDeco, bottom: -150, right: -110 }} />
      <View pointerEvents="none" style={{ position: "absolute", width: 200, height: 200, borderRadius: 999, backgroundColor: t.c.heroDeco, top: -90, left: -60 }} />
      <Logo size={36} onHero />
      <View style={{ gap: t.space.space5, maxWidth: 420 }}>
        <View style={{ gap: t.space.space3 }}>
          <Txt variant="titleLg" color={t.c.onHero} style={{ fontSize: 36, lineHeight: 42 }}>
            {copy.title}
          </Txt>
          <Txt color={t.c.onHeroMuted}>{copy.body}</Txt>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 300, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, padding: t.space.space4, gap: t.space.space2 }}
        >
          <Txt variant="caption" color={t.c.inkMuted}>
            October · spent
          </Txt>
          <Txt variant="amountLg">₦412,500</Txt>
          <View style={{ height: 6, borderRadius: 999, backgroundColor: t.c.surfaceAlt }}>
            <View style={{ width: "62%", height: "100%", borderRadius: 999, backgroundColor: t.c.primary }} />
          </View>
          <View style={{ gap: 6, marginTop: t.space.space2 }}>
            {WELCOME_PREVIEW.map((row) => (
              <View key={row.title} style={{ flexDirection: "row", justifyContent: "space-between", gap: t.space.space2 }}>
                <Txt variant="bodySm" numberOfLines={1} style={{ flex: 1 }}>
                  {row.title}
                </Txt>
                <Txt variant="bodySm" color={row.amount < 0 ? t.c.danger : t.c.positive}>
                  {`${row.amount < 0 ? "−" : "+"}${formatMoney(Math.abs(row.amount)).replace(/\.00$/, "")}`}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Txt variant="caption" color={t.c.onHeroMuted}>
        {TRUST_BULLETS.map((b) => b.label).join(" · ")}
      </Txt>
    </View>
  );
}
