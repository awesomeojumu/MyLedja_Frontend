import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, SpringPressable, Txt, useTheme, type IconName } from "@/design";
import { splitLayout } from "@/lib";
import { BrandPane, type BrandKind } from "@/features/auth-onboarding/components/BrandPane";
import { StepHeader } from "@/features/auth-onboarding/components/StepHeader";

/**
 * Every auth and setup screen. Phones get the navy hero (back, progress, title) with the form on a white sheet that
 * overlaps it; wide screens keep the brand pane on the left and the form on the right. Buttons sit right under the
 * form in both, never pinned to the bottom.
 */
export function AuthShell({
  brand = "default",
  step,
  icon,
  onBack,
  topRight,
  title,
  subtitle,
  footer,
  hint,
  children,
}: {
  brand?: BrandKind;
  step?: { label: string; current: number; total: number };
  /** A tile above the title on code and setup screens, e.g. "mail" on Check your email. */
  icon?: IconName;
  onBack?: () => void;
  topRight?: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  hint?: string;
  children?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const compact = !splitLayout(t.widthClass, t.portrait);
  const hintRow = hint ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name="info" size={14} color={t.c.inkMuted} />
      <Txt variant="caption" color={t.c.inkMuted}>
        {hint}
      </Txt>
    </View>
  ) : null;

  if (compact) {
    const bars = step ? Array.from({ length: step.total }, (_, i) => i < step.current) : [];
    return (
      <View style={{ flex: 1, backgroundColor: t.c.hero }}>
        <View style={{ paddingTop: insets.top + t.space.space2, paddingHorizontal: t.space.space5, paddingBottom: t.space.space8 + t.space.space3, overflow: "hidden" }}>
          <View pointerEvents="none" style={{ position: "absolute", width: 220, height: 220, borderRadius: 999, backgroundColor: t.c.heroDeco, top: -90, right: -70 }} />
          <View pointerEvents="none" style={{ position: "absolute", width: 120, height: 120, borderRadius: 999, backgroundColor: t.c.heroDeco, bottom: -88, left: 24 }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 }}>
            {onBack ? (
              <SpringPressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="chevron-left" size={18} color={t.c.onHero} />
              </SpringPressable>
            ) : (
              <View />
            )}
            {step ? (
              <Txt variant="caption" color={t.c.onHeroMuted}>
                {`${step.label} · step ${step.current} of ${step.total}`}
              </Txt>
            ) : null}
          </View>
          {bars.length ? (
            <View style={{ flexDirection: "row", gap: 6, marginTop: t.space.space3 }}>
              {bars.map((filled, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: filled ? t.c.onHero : t.c.heroDeco }} />
              ))}
            </View>
          ) : null}
          {icon ? (
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center", marginTop: t.space.space5 }}>
              <Icon name={icon} size={24} color={t.c.onHero} />
            </View>
          ) : null}
          {title ? (
            <View style={{ gap: 4, marginTop: icon ? t.space.space3 : t.space.space5 }}>
              <Txt variant="titleLg" color={t.c.onHero} accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>
                {title}
              </Txt>
              {subtitle ? (typeof subtitle === "string" ? <Txt variant="bodySm" color={t.c.onHeroMuted}>{subtitle}</Txt> : subtitle) : null}
            </View>
          ) : null}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, marginTop: -t.space.space6, backgroundColor: t.c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: t.space.space5,
            paddingTop: t.space.space6,
            paddingBottom: Math.max(insets.bottom, t.space.space4) + t.space.space4,
            gap: t.space.space4,
          }}
        >
          {children}
          {footer}
          {hintRow}
          {topRight ? <View style={{ marginTop: "auto", paddingTop: t.space.space4, alignItems: "center" }}>{topRight}</View> : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.c.bg }}>
      <BrandPane kind={brand} />
      <View style={{ flex: 3, justifyContent: "center", paddingVertical: t.space.space8, paddingHorizontal: t.space.space8 }}>
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: t.space.space5 }}>
          <StepHeader label={step?.label} current={step?.current} total={step?.total} onBack={onBack} topRight={topRight} />
          <View style={{ gap: t.space.space4 }}>
            {icon ? (
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.c.primarySoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name={icon} size={24} color={t.c.primary} />
              </View>
            ) : null}
            {title ? (
              <View style={{ gap: 4 }}>
                <Txt variant="titleLg" accessibilityRole="header">
                  {title}
                </Txt>
                {subtitle ? (typeof subtitle === "string" ? <Txt variant="bodySm" color={t.c.inkMuted}>{subtitle}</Txt> : subtitle) : null}
              </View>
            ) : null}
            {children}
            {footer}
            {hintRow}
          </View>
        </View>
      </View>
    </View>
  );
}
