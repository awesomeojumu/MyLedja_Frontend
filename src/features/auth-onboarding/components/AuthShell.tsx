import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Txt, useTheme } from "@/design";
import { splitLayout } from "@/lib";
import { BrandPane, type BrandKind } from "@/features/auth-onboarding/components/BrandPane";
import { StepHeader } from "@/features/auth-onboarding/components/StepHeader";

export function AuthShell({
  brand = "default",
  step,
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
  const header = (
    <StepHeader
      label={step?.label}
      current={step?.current}
      total={step?.total}
      onBack={onBack}
      topRight={compact ? undefined : topRight}
    />
  );
  const body = (
    <View style={{ gap: t.space.space4 }}>
      {title ? (
        <View style={{ gap: 6 }}>
          <Txt variant="titleLg" accessibilityRole="header">
            {title}
          </Txt>
          {subtitle ? (typeof subtitle === "string" ? <Txt color={t.c.inkMuted}>{subtitle}</Txt> : subtitle) : null}
        </View>
      ) : null}
      {children}
      {!compact ? footer : null}
      {!compact && hint ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="info" size={14} color={t.c.inkMuted} />
          <Txt variant="caption" color={t.c.inkMuted}>
            {hint}
          </Txt>
        </View>
      ) : null}
    </View>
  );

  if (compact) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: t.space.space5, paddingTop: t.space.space2 }}>{header}</View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: t.space.space5,
            paddingTop: t.space.space4,
            paddingBottom: t.space.space6,
            gap: t.space.space4,
            flexGrow: 1,
          }}
        >
          {body}
        </ScrollView>
        {footer || hint ? (
          <View
            style={{
              paddingHorizontal: t.space.space5,
              paddingTop: t.space.space3,
              paddingBottom: Math.max(insets.bottom, t.space.space4),
              gap: t.space.space2,
            }}
          >
            {footer}
            {hint ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="info" size={14} color={t.c.inkMuted} />
                <Txt variant="caption" color={t.c.inkMuted}>
                  {hint}
                </Txt>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.c.bg }}>
      <BrandPane kind={brand} />
      <View style={{ flex: 3, justifyContent: "center", paddingVertical: t.space.space8, paddingHorizontal: t.space.space8 }}>
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: t.space.space5 }}>
          {header}
          {body}
        </View>
      </View>
    </View>
  );
}
