import { View } from "react-native";
import { Icon, Logo, Txt, useTheme } from "../../../design";
import { BRAND, BRAND_FOOTER, TRUST_BULLETS, type BrandKind } from "../auth-copy";

export type { BrandKind };

export function BrandPane({ kind = "default" }: { kind?: BrandKind }) {
  const t = useTheme();
  const copy = BRAND[kind];
  return (
    <View style={{ flex: 2, backgroundColor: t.c.hero, padding: t.space.space8, justifyContent: "space-between", overflow: "hidden" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: t.c.heroDeco,
          bottom: -90,
          left: -70,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: t.c.heroDeco,
          top: -80,
          right: -60,
        }}
      />
      <Logo size={36} onHero />
      <View style={{ gap: t.space.space5, maxWidth: 420 }}>
        <Txt variant="titleLg" color={t.c.onHero} style={{ fontSize: 36, lineHeight: 42 }}>
          {copy.title}
        </Txt>
        <Txt color={t.c.onHeroMuted}>{copy.body}</Txt>
        <View style={{ gap: t.space.space3 }}>
          {TRUST_BULLETS.map((item) => (
            <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: t.radius.radiusMd,
                  backgroundColor: t.c.heroDeco,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={item.icon} size={18} color={t.c.onHero} />
              </View>
              <Txt variant="label" color={t.c.onHero} style={{ fontWeight: "600" }}>
                {item.label}
              </Txt>
            </View>
          ))}
        </View>
      </View>
      <Txt variant="caption" color={t.c.onHeroMuted}>
        {BRAND_FOOTER}
      </Txt>
    </View>
  );
}
