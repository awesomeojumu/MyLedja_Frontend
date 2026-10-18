/* Foundations: Txt, Icon, Logo, LogoMark, CategoryIcon, Avatar, Badge, StatusBadge. */
import React from 'react';
import { Platform, Pressable, StyleProp, Text, TextProps, TextStyle, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { ICONS, IconName } from "@/design/icons";
import { useTheme } from "@/design/theme";
import { categoryInfo, CategoryTone } from "@/design/format";
import { TypeStyle } from "@/design/tokens";

/** Text in a type token and colour token. Every string in the app goes through this. */
export function Txt({ variant = 'body', color, style, ...rest }: TextProps & { variant?: TypeStyle; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={2}
      {...rest}
      style={[
        t.text(variant),
        { color: color ?? t.c.ink },
        Platform.OS === "web" ? ({ whiteSpace: "pre-wrap", wordBreak: "normal" } as TextStyle) : null,
        style,
      ]}
    />
  );
}

export interface IconProps { name: IconName; size?: number; color?: string; label?: string; strokeWidth?: number }
/** One Lucide line icon. Decorative unless `label` is set. */
/** Small icons (16px and below) keep a 1.5px line so they don't go faint; 20px and up use 2. */
export function Icon({ name, size = 20, color, label, strokeWidth }: IconProps) {
  const sw = strokeWidth ?? (size <= 16 ? (1.5 * 24) / size : 2);
  const t = useTheme();
  const C = ICONS[name];
  return (
    <View accessible={!!label} accessibilityLabel={label} accessibilityRole={label ? 'image' : undefined} importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}>
      <C size={size} color={color ?? t.c.ink} strokeWidth={sw} />
    </View>
  );
}

export function LogoMark({ size = 32, onHero, title }: { size?: number; onHero?: boolean; title?: string }) {
  const t = useTheme();
  const l = onHero ? t.c.onHero : t.c.primary, line = onHero ? t.c.onHeroMuted : t.c.chart2;
  return (
    <View accessible={!!title} accessibilityLabel={title} accessibilityRole={title ? 'image' : undefined}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x={12} y={10} width={11} height={44} rx={5.5} fill={l} />
        <Rect x={12} y={43} width={40} height={11} rx={5.5} fill={l} />
        <Rect x={29} y={28} width={23} height={7} rx={3.5} fill={line} />
        <Rect x={29} y={16} width={15} height={7} rx={3.5} fill={line} />
        <Circle cx={51} cy={19.5} r={4} fill={onHero ? t.c.onHero : t.c.catOrange} />
      </Svg>
    </View>
  );
}

/** The MyLedja lockup. */
export function Logo({ size = 32, onHero, markOnly }: { size?: number; onHero?: boolean; markOnly?: boolean }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel="MyLedja" accessibilityRole="image" style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }}>
      <LogoMark size={size} onHero={onHero} />
      {markOnly ? null : (
        <Text style={[t.text('titleLg'), { fontSize: Math.round(size * 0.72), lineHeight: Math.round(size * 0.9), letterSpacing: -0.03 * size * 0.72, color: onHero ? t.c.onHero : t.c.ink }]}>MyLedja</Text>
      )}
    </View>
  );
}

export function toneColors(t: ReturnType<typeof useTheme>, tone: CategoryTone): { fg: string; bg: string } {
  if (tone === 'transfer') return { fg: t.c.transfer, bg: t.c.transferSoft };
  const key = 'cat' + tone[0].toUpperCase() + tone.slice(1);
  return { fg: (t.c as any)[key], bg: (t.c as any)[key + 'Soft'] };
}

export interface CategoryIconProps { category?: string; icon?: IconName; tone?: CategoryTone; size?: 'sm' | 'md' | 'lg'; round?: boolean }
/** A category's coloured tile with its icon. */
export function CategoryIcon({ category, icon, tone, size = 'md', round }: CategoryIconProps) {
  const t = useTheme();
  const info = categoryInfo(category);
  const { fg, bg } = toneColors(t, tone ?? info[1]);
  const px = size === 'lg' ? 48 : size === 'sm' ? 32 : 40;
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: px, height: px, borderRadius: round ? 999 : t.radius.radiusMd, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={(icon ?? info[0]) as IconName} size={size === 'lg' ? 22 : size === 'sm' ? 16 : 20} color={fg} />
    </View>
  );
}

const AV_TONES: CategoryTone[] = ['orange', 'teal', 'pink', 'gold', 'green', 'purple', 'sky'];
export interface AvatarProps { name?: string; initials?: string; tone?: CategoryTone; size?: number; onPress?: () => void; label?: string }
export function Avatar({ name = '', initials, tone, size = 44, onPress, label }: AvatarProps) {
  const t = useTheme();
  const ini = initials ?? name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const { fg, bg } = toneColors(t, tone ?? AV_TONES[(name.charCodeAt(0) || 0) % AV_TONES.length]);
  const body = (
    <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[t.text('label'), { fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44), color: fg, fontWeight: '700' }]}>{ini}</Text>
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label ?? `Account menu for ${name}`} hitSlop={4}>{body}</Pressable>
    : <View accessible accessibilityLabel={name}>{body}</View>;
}

export type Tone = 'neutral' | 'primary' | 'positive' | 'warning' | 'danger' | 'transfer';
const TONE_ICON: Partial<Record<Tone, IconName>> = { positive: 'circle-check', warning: 'triangle-alert', danger: 'circle-alert', primary: 'info', transfer: 'arrow-left-right' };
export function toneSoft(t: ReturnType<typeof useTheme>, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'primary': return { fg: t.c.onPrimarySoft, bg: t.c.primarySoft };
    case 'positive': return { fg: t.c.positive, bg: t.c.positiveSoft };
    case 'warning': return { fg: t.c.warning, bg: t.c.warningSoft };
    case 'danger': return { fg: t.c.danger, bg: t.c.dangerSoft };
    case 'transfer': return { fg: t.c.transfer, bg: t.c.transferSoft };
    default: return { fg: t.c.inkMuted, bg: t.c.surfaceAlt };
  }
}

export interface BadgeProps { tone?: Tone; icon?: IconName | false; children?: React.ReactNode }
export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  const t = useTheme();
  const { fg, bg } = toneSoft(t, tone);
  const ic = icon === false ? null : icon ?? TONE_ICON[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, height: 24, borderRadius: t.radius.radiusSm, backgroundColor: bg }}>
      {ic ? <Icon name={ic} size={14} color={fg} /> : null}
      <Text style={[t.text('caption'), { color: fg, fontWeight: '600' }]}>{children}</Text>
    </View>
  );
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed' | 'conflict' | 'offline' | 'estimate' | 'reconciled';
const STATUS: Record<SyncStatus, [Tone, IconName, string]> = {
  synced: ['neutral', 'check', 'Synced'], pending: ['primary', 'clock', 'Saved on device'], syncing: ['primary', 'refresh-cw', 'Syncing'],
  failed: ['danger', 'circle-alert', 'Sync failed'], conflict: ['warning', 'triangle-alert', 'Needs review'],
  offline: ['neutral', 'wifi-off', 'Offline'], estimate: ['warning', 'info', 'Estimate'], reconciled: ['positive', 'circle-check', 'Reconciled'],
};
export function StatusBadge({ status, label }: { status: SyncStatus; label?: string }) {
  const s = STATUS[status] ?? STATUS.synced;
  return <Badge tone={s[0]} icon={s[1]}>{label ?? s[2]}</Badge>;
}
