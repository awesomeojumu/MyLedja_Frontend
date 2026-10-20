import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Icon, ProgressRing, SpringPressable, Txt, maxWidth, useTheme, type IconName } from "@/design";

export function MoreHeader({
  topInset,
  initials,
  name,
  email,
  workspace,
  canSwitch,
  onSettings,
  onWorkspace,
}: {
  topInset: number;
  initials: string;
  name: string;
  email: string;
  workspace: string;
  canSwitch: boolean;
  onSettings: () => void;
  onWorkspace: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space4, paddingHorizontal: t.space.space5, paddingBottom: 46 }}>
      <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", gap: t.space.space4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
          <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}>
            <Txt variant="titleSm" color={t.c.onHero} style={{ fontWeight: "700" }}>{initials}</Txt>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" numberOfLines={1}>{name}</Txt>
            <Txt variant="caption" color={t.c.onHeroMuted} numberOfLines={1}>{email}</Txt>
          </View>
          <SpringPressable
            onPress={onSettings}
            accessibilityRole="button"
            accessibilityLabel="All settings"
            style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="settings" size={18} color={t.c.onHero} />
          </SpringPressable>
        </View>
        <Pressable
          onPress={onWorkspace}
          accessibilityRole="button"
          accessibilityLabel={`Workspace ${workspace}. ${canSwitch ? "Switch workspace" : "Workspace settings"}`}
          style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, paddingHorizontal: t.space.space3, paddingVertical: t.space.space2, borderRadius: t.radius.radiusMd, backgroundColor: t.c.heroDeco }}
        >
          <Icon name="briefcase" size={18} color={t.c.onHeroMuted} />
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 11 }}>Workspace</Txt>
            <Txt variant="label" color={t.c.onHero}>{workspace}</Txt>
          </View>
          <Txt variant="caption" color={t.c.onHeroMuted}>{canSwitch ? "Switch" : "Manage"}</Txt>
          <Icon name={canSwitch ? "chevron-down" : "chevron-right"} size={14} color={t.c.onHeroMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export function HealthCard({ score, label, sub, loading, onPress }: { score: number | null; label: string; sub: string; loading: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={score == null ? "Financial health" : `Financial health ${score} out of 100, ${label}`}
      accessibilityHint="Opens your health score"
      style={{
        marginTop: -30,
        marginHorizontal: t.space.space4,
        flexDirection: "row",
        alignItems: "center",
        gap: t.space.space3,
        padding: t.space.space4,
        borderRadius: t.radius.radiusLg,
        backgroundColor: t.c.surface,
        borderWidth: 1,
        borderColor: t.c.border,
        shadowColor: "#0d111c",
        shadowOpacity: t.scheme === "dark" ? 0 : 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      <ProgressRing
        value={score ?? 0}
        max={100}
        size={54}
        stroke={6}
        tone={score == null || score >= 60 ? "positive" : score >= 40 ? "warning" : "danger"}
        center={<Txt variant="amountMd">{score == null ? "—" : String(score)}</Txt>}
        spoken={score == null ? "Score not ready" : `Score ${score} out of 100`}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="titleSm">{loading ? "Financial health" : `Financial health · ${label}`}</Txt>
        <Txt variant="caption" color={t.c.inkMuted} numberOfLines={2}>{sub}</Txt>
      </View>
      <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600", paddingHorizontal: 4 }} accessibilityRole="header">{children}</Txt>;
}

export function MoneyTile({ icon, tone, title, value, sub, subColor, onPress }: { icon: IconName; tone: { fg: string; bg: string }; title: string; value: string; sub?: string; subColor?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${value}${sub ? `, ${sub}` : ""}`} style={{ flexGrow: 1, flexBasis: "40%", minWidth: 140 }}>
      <View style={{ flex: 1, padding: t.space.space3, gap: 6, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={17} color={tone.fg} />
        </View>
        <Txt variant="caption" color={t.c.inkMuted}>{title}</Txt>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <Txt variant="amountMd" numberOfLines={1}>{value}</Txt>
          {sub ? <Txt variant="caption" color={subColor ?? t.c.inkMuted}>{sub}</Txt> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>{children}</View>;
}

export function ListRow({ icon, label, last, right, onPress, danger }: { icon: IconName; label: string; last?: boolean; right?: ReactNode; onPress?: () => void; danger?: boolean }) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, minHeight: 52, paddingHorizontal: t.space.space4, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.c.border }}>
      <Icon name={icon} size={18} color={danger ? t.c.danger : t.c.inkMuted} />
      <Txt variant="body" color={danger ? t.c.danger : t.c.ink} style={{ flex: 1 }}>{label}</Txt>
      {right}
      {onPress && !right ? <Icon name="chevron-right" size={16} color={t.c.inkMuted} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} android_ripple={{ color: t.c.surfaceAlt }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** An on/off switch drawn from tokens; the design system doesn't ship one. */
export function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      style={{ width: 44, height: 26, borderRadius: 999, padding: 3, backgroundColor: value ? t.c.primary : t.c.surfaceAlt, borderWidth: value ? 0 : 1, borderColor: t.c.borderStrong, opacity: disabled ? 0.5 : 1, justifyContent: "center" }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: value ? t.c.onPrimary : t.c.surface, alignSelf: value ? "flex-end" : "flex-start", borderWidth: value ? 0 : 1, borderColor: t.c.borderStrong }} />
    </Pressable>
  );
}

export function Badge({ count }: { count: number }) {
  const t = useTheme();
  return (
    <View style={{ minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 999, backgroundColor: t.c.primary, alignItems: "center", justifyContent: "center" }}>
      <Txt variant="caption" color={t.c.onPrimary} style={{ fontSize: 11, fontWeight: "600" }}>{count > 99 ? "99+" : String(count)}</Txt>
    </View>
  );
}
