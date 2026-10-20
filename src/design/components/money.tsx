/* Money: Amount, HeroBalance, StatTile, SummaryCard, ProgressBar, ProgressRing, BudgetTile, TransactionRow, TransactionDetail. */
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from "@/design/theme";
import { formatDateDMY, formatMoney } from "@/design/format";
import { Rise, SpringPressable, useRollingNumber } from "@/design/motion";
import { IconName } from "@/design/icons";
import { CategoryIcon, Icon, StatusBadge, SyncStatus, Txt } from "@/design/components/foundations";
import { Button } from "@/design/components/actions";
import { Banner } from "@/design/components/surfaces";

export type MoneyKind = 'income' | 'expense' | 'transfer' | 'neutral';

export interface AmountProps { value: number; currency?: string; kind?: MoneyKind; size?: 'sm' | 'md' | 'lg' | 'xl'; estimate?: boolean; hidden?: boolean; animate?: boolean }
/** Money the MyLedja way: ₦, kobo always, true minus, tabular. Income +green, expense −ink, transfer no sign. */
export function Amount({ value, currency, kind: kindProp = 'neutral', size = 'md', estimate, hidden, animate }: AmountProps) {
  const t = useTheme();
  // Zero is always neutral; a neutral value below zero is negative.
  let kind: string = !Number(value) && kindProp !== 'transfer' ? 'neutral' : kindProp;
  if (kind === 'neutral' && value < 0) kind = 'negative';
  const rolled = useRollingNumber(Math.abs(value), !animate || t.reduceMotion);
  const style = t.text(size === 'xl' ? 'amountHero' : size === 'lg' ? 'amountLg' : size === 'sm' ? 'amountSm' : 'amountMd');
  const color = kind === 'income' ? t.c.positive : kind === 'transfer' ? t.c.transfer : kind === 'expense' || kind === 'negative' ? t.c.negative : t.c.ink;
  if (hidden) return <Text accessibilityLabel="Amount hidden" style={[style, { color: t.c.inkMuted }]}>₦ ••••••</Text>;
  const sign = kind === 'expense' || kind === 'negative' ? 'minus' : kind === 'income' ? 'plus' : null;
  const exact = formatMoney(value, currency, { sign });
  const label = (kind === 'income' ? 'Income ' : kind === 'expense' ? 'Expense ' : kind === 'transfer' ? 'Transfer ' : '') + exact.replace('−', 'minus ');
  return (
    <Text accessibilityLabel={label + (estimate ? ', estimate' : '')} style={[style, { color }]}>
      {animate ? formatMoney(rolled, currency, { sign }) : exact}
      {estimate ? <Text style={[t.text('caption'), { color: t.c.warning }]}> est.</Text> : null}
    </Text>
  );
}

export interface HeroBalanceProps { value: number; label?: string; currency?: string; freshness?: string; hidden?: boolean; onToggleHidden?: () => void; actions?: { label: string; icon: IconName; onPress?: () => void }[] }
/** The solid blue balance card on Home. The number rolls when it changes. */
export function HeroBalance({ value, label = 'Available cash', currency, freshness, hidden, onToggleHidden, actions }: HeroBalanceProps) {
  const t = useTheme();
  const rolled = useRollingNumber(value, t.reduceMotion);
  return (
    <Rise style={{ overflow: 'hidden', borderRadius: t.radius.radiusXl, backgroundColor: t.c.hero, paddingVertical: 20, paddingHorizontal: 16, gap: 8 }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -50, width: 160, height: 160, borderRadius: 999, backgroundColor: t.c.heroDeco }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -24, bottom: -30, width: 96, height: 96, borderRadius: 999, backgroundColor: t.c.heroDeco }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="label" color={t.c.onHeroMuted}>{label}</Txt>
        {onToggleHidden ? (
          <Pressable onPress={onToggleHidden} accessibilityRole="button" accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'} hitSlop={12}>
            <Icon name={hidden ? 'eye' : 'eye-off'} size={18} color={t.c.onHero} />
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityLabel={hidden ? 'Balance hidden' : `Balance ${formatMoney(value, currency)}`} style={[t.text('amountHero'), { color: t.c.onHero }]}>
        {hidden ? '₦ ••••••' : formatMoney(rolled, currency)}
      </Text>
      {freshness ? <Txt variant="caption" color={t.c.onHeroMuted}>{freshness}</Txt> : null}
      {actions ? (
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          {actions.map((a) => (
            <SpringPressable key={a.label} onPress={a.onPress} hapticOn="start" accessibilityRole="button" accessibilityLabel={a.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: 'center', justifyContent: 'center' }}><Icon name={a.icon} size={18} color={t.c.onHero} /></View>
              <Txt variant="caption" color={t.c.onHero} style={{ fontWeight: '500' }}>{a.label}</Txt>
            </SpringPressable>
          ))}
        </View>
      ) : null}
    </Rise>
  );
}

export interface StatTileProps { label: string; value?: number; count?: number; kind?: 'spent' | 'income' | 'transfer' | 'neutral'; icon?: IconName; note?: string; animate?: boolean; hidden?: boolean; size?: 'md' | 'lg' }
export function StatTile({ label, value = 0, count, kind = 'neutral', icon, note, animate, hidden, size = 'md' }: StatTileProps) {
  const t = useTheme();
  const bg = kind === 'spent' ? t.c.catOrangeSoft : kind === 'income' ? t.c.catGreenSoft : kind === 'transfer' ? t.c.transferSoft : t.c.surface;
  const fg = kind === 'spent' ? t.c.catOrange : kind === 'income' ? t.c.catGreen : kind === 'transfer' ? t.c.transfer : t.c.ink;
  return (
    <Rise style={{ flex: 1, gap: 8, padding: size === 'lg' ? 20 : 10, borderRadius: size === 'lg' ? t.radius.radiusXl : t.radius.radiusLg, backgroundColor: bg, borderWidth: kind === 'neutral' ? 1 : 0, borderColor: t.c.borderStrong }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: t.c.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color={fg} /></View> : null}
        <Txt variant="label">{label}</Txt>
      </View>
      {count != null ? <Txt variant="amountLg">{String(count)}</Txt> : <Amount value={value} kind={kind === 'transfer' ? 'transfer' : 'neutral'} size={size === 'lg' ? 'xl' : 'md'} animate={animate} hidden={hidden} />}
      {note ? <Txt variant="caption" color={t.c.inkMuted}>{note}</Txt> : null}
    </Rise>
  );
}

export interface SummaryCardProps { label: string; value: number; kind?: MoneyKind; explain?: string; delta?: number; goodWhenUp?: boolean; deltaLabel?: string; freshness?: string; hidden?: boolean; onExplain?: () => void }
export function SummaryCard({ label, value, kind, explain, delta, goodWhenUp = true, deltaLabel = 'vs last month', freshness, hidden, onExplain }: SummaryCardProps) {
  const t = useTheme();
  const good = delta != null && (delta >= 0) === goodWhenUp;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Txt variant="label" color={t.c.inkMuted}>{label}</Txt>
        {explain ? <Pressable onPress={onExplain} accessibilityRole="button" accessibilityLabel={`How is ${label} calculated? ${explain}`} hitSlop={14}><Icon name="info" size={14} color={t.c.inkMuted} /></Pressable> : null}
      </View>
      <Amount value={value} kind={kind} size="lg" hidden={hidden} />
      {delta != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={delta >= 0 ? 'trending-up' : 'trending-down'} size={14} color={good ? t.c.positive : t.c.warning} />
          <Txt variant="caption" color={good ? t.c.positive : t.c.warning}>{(delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1)}% {deltaLabel}</Txt>
        </View>
      ) : null}
      {freshness ? <Txt variant="caption" color={t.c.inkMuted}>{freshness}</Txt> : null}
    </View>
  );
}

function toneOf(pct: number) { return pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'primary'; }

export interface ProgressBarProps { label?: string; value: number; max: number; money?: boolean; tone?: 'primary' | 'positive' | 'warning' | 'danger'; currency?: string }
export function ProgressBar({ label, value, max, money, tone, currency }: ProgressBarProps) {
  const t = useTheme();
  const pct = max ? (value / max) * 100 : 0, tn = tone ?? toneOf(pct);
  const col = { primary: t.c.primary, positive: t.c.positive, warning: t.c.warning, danger: t.c.danger }[tn];
  const left = max - value;
  return (
    <View style={{ gap: 6 }}>
      {label ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt variant="label" style={{ fontWeight: '600' }}>{label}</Txt><Txt variant="caption" color={t.c.inkMuted}>{Math.round(pct)}% used</Txt></View> : null}
      <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} style={{ height: 8, borderRadius: 999, backgroundColor: t.c.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 999, backgroundColor: col }} />
      </View>
      {money ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="amountSm" color={t.c.inkMuted}>{formatMoney(value, currency)} of {formatMoney(max, currency)}</Txt>
          <Txt variant="amountSm" color={tn === 'danger' ? t.c.danger : tn === 'warning' ? t.c.warning : t.c.inkMuted} style={{ fontWeight: '600' }}>
            {left >= 0 ? formatMoney(left, currency) + ' left' : formatMoney(-left, currency) + ' over'}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

export interface ProgressRingProps { value: number; max: number; label?: string; size?: number; stroke?: number; tone?: 'primary' | 'positive' | 'warning' | 'danger';
  /** Replaces the percentage in the middle (for a score, say). */
  center?: React.ReactNode;
  /** Replaces the spoken "N% used". */
  spoken?: string }
export function ProgressRing({ value, max, label, size = 56, stroke = 6, tone, center, spoken }: ProgressRingProps) {
  const t = useTheme();
  const pct = Math.max(0, max ? (value / max) * 100 : 0), r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const col = { primary: t.c.primary, positive: t.c.positive, warning: t.c.warning, danger: t.c.danger }[tone ?? toneOf(pct)];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={spoken ?? `${label ? label + ': ' : ''}${Math.round(pct)}% used`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - Math.min(pct, 100) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {center !== undefined ? center : <Text style={[t.text('caption'), { fontWeight: '600', color: t.c.ink, fontSize: size < 48 ? 10 : 12, fontVariant: ['tabular-nums'] }]}>{Math.round(pct)}%</Text>}
    </View>
  );
}

export interface BudgetTileProps { category: string; value: number; max: number; layout?: 'tile' | 'row'; currency?: string; onPress?: () => void }
export function BudgetTile({ category, value, max, layout = 'tile', currency, onPress }: BudgetTileProps) {
  const t = useTheme();
  const pct = max ? value / max : 0, d = max - value;
  const col = pct > 1 ? t.c.danger : pct >= 0.8 ? t.c.warning : t.c.inkMuted;
  const left = d >= 0 ? formatMoney(d, currency) + ' left' : formatMoney(-d, currency) + ' over';
  const body = layout === 'row' ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
      <CategoryIcon category={category} size="sm" />
      <View style={{ flex: 1 }}><Txt variant="label" style={{ fontWeight: '600' }}>{category}</Txt><Txt variant="caption" color={col} style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{left}</Txt></View>
      <ProgressRing value={value} max={max} label={category} size={40} stroke={5} />
    </View>
  ) : (
    <View style={{ width: 148, gap: 10, padding: 14, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.borderStrong }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><CategoryIcon category={category} size="sm" /><ProgressRing value={value} max={max} label={category} size={48} /></View>
      <Txt variant="label" style={{ fontWeight: '600' }}>{category}</Txt>
      <Txt variant="caption" color={col} style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{left}</Txt>
    </View>
  );
  return onPress ? <SpringPressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${category} budget, ${left}`}>{body}</SpringPressable> : body;
}

export interface TransactionRowProps { title: string; category?: string; account?: string; amount: number; kind: 'expense' | 'income' | 'transfer'; time?: string; status?: 'pending' | 'syncing' | 'failed' | 'conflict' | null; icon?: IconName; hidden?: boolean; onPress?: () => void }
/** One record in a list. Category tile says what; the signed amount says which way. */
export function TransactionRow({ title, category, account, amount, kind, time, status, icon, hidden, onPress }: TransactionRowProps) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: t.c.surface, borderBottomWidth: 1, borderBottomColor: t.c.border }}>
      <CategoryIcon category={kind === 'transfer' ? 'Transfer' : category} icon={icon} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: '500' }}>{title}</Txt>
        <Txt variant="bodySm" color={t.c.inkMuted} numberOfLines={1}>{[category, account].filter(Boolean).join(' · ')}</Txt>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Amount value={amount} kind={kind} hidden={hidden} />
        {status ? <StatusBadge status={status as SyncStatus} /> : time ? <Txt variant="caption" color={t.c.inkMuted}>{time}</Txt> : null}
      </View>
    </View>
  );
  const spoken = `${title}, ${kind}${hidden ? ', amount hidden' : ''}`;
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens the details"
      android_ripple={{ color: t.c.surfaceAlt }}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={spoken}>
      {body}
    </View>
  );
}

export interface TransactionDetailProps { transaction: { title: string; category?: string; amount: number; kind: 'expense' | 'income' | 'transfer'; account?: string; date?: string; status?: SyncStatus; added?: string }; onRetry?: () => void }
/** Body of the details Sheet. Put detailActions() in the Sheet footer. */
export function TransactionDetail({ transaction: x, onRetry }: TransactionDetailProps) {
  const t = useTheme();
  const facts: [string, string | undefined][] = [
    ['Category', x.kind === 'transfer' ? 'Transfer' : x.category],
    [x.kind === 'income' ? 'Paid into' : x.kind === 'transfer' ? 'Accounts' : 'Paid from', x.account],
    ['Date', formatDateDMY(x.date) || x.date],
    ['Added', x.added ?? 'By you, on this phone'],
    ['Sync', x.status === 'failed' ? 'Not backed up yet' : x.status === 'pending' ? 'Waiting to sync' : x.status === 'conflict' ? 'Needs review' : 'Backed up'],
  ];
  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <CategoryIcon category={x.kind === 'transfer' ? 'Transfer' : x.category} size="lg" />
        <Txt variant="titleMd" style={{ textAlign: 'center' }}>{x.title}</Txt>
        <Amount value={x.amount} kind={x.kind} size="xl" />
        {x.status && x.status !== 'synced' ? <StatusBadge status={x.status} /> : null}
      </View>
      <View style={{ paddingHorizontal: 14, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
        {facts.filter((f) => f[1]).map(([k, v], i, a) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderBottomColor: t.c.border }}>
            <Txt variant="bodySm" color={t.c.inkMuted}>{k}</Txt><Txt variant="bodySm" style={{ fontWeight: '500', textAlign: 'right', flexShrink: 1 }}>{v}</Txt>
          </View>
        ))}
      </View>
      {x.status === 'failed' ? <Banner tone="danger" title="This didn’t sync" action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}>It’s safe on this phone. Try again when you have a stable connection.</Banner> : null}
    </View>
  );
}

/** Delete (instant, with Undo toast) and Edit (reuses the add form). */
export function detailActions(h: { onEdit?: () => void; onDelete?: () => void }) {
  return [
    <View key="d" style={{ flex: 1 }}><Button variant="secondary" icon="trash-2" fullWidth onPress={h.onDelete}>Delete</Button></View>,
    <View key="e" style={{ flex: 1 }}><Button icon="pencil" fullWidth onPress={h.onEdit}>Edit</Button></View>,
  ];
}
