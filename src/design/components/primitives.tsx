import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import { t } from '@/i18n';
import tokens from '../tokens.json';
import { useDesign, useTheme } from '../ThemeProvider';
import { useSizeClass } from '../size';
import { Button } from './Button';
import { Text } from './Text';

const s = tokens.spacing;
const r = tokens.radius;

export function Card({ style, cream, ...rest }: ViewProps & { cream?: boolean }) {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: cream ? tokens.color['canvas-cream'] : theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: r['rounded-lg'],
          padding: phone ? s['spacing-lg'] : s['spacing-xl'],
        },
        style,
      ]}
    />
  );
}

export function Banner({ message, testID }: { message: string; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.tagFill,
        borderRadius: r['rounded-md'],
        padding: s['spacing-md'],
      }}
    >
      <Text variant="caption" style={{ color: theme.tagText }}>
        {message}
      </Text>
    </View>
  );
}

/** Errors sit beside what failed, never in a toast (DESIGN.md 2.8). */
export function InlineError({ message, testID }: { message: string; testID?: string }) {
  const theme = useTheme();
  return (
    <View testID={testID} accessible
      accessibilityRole="alert" style={{ flexDirection: 'row', gap: s['spacing-sm'], alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.error }} />
      <Text variant="caption" style={{ flexShrink: 1 }}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', gap: s['spacing-md'], padding: s['spacing-xl'] }}>
      <Text variant="heading-sm" accessibilityRole="header">
        {title}
      </Text>
      <Text tone="textSecondary" style={{ textAlign: 'center' }}>
        {body}
      </Text>
      <Button label={actionLabel} onPress={onAction} />
    </View>
  );
}

export function Placeholder({ width = '100%', height = 16, testID }: { width?: number | `${number}%`; height?: number; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID ?? 'placeholder'}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width, height, borderRadius: r['rounded-xs'], backgroundColor: theme.border }}
    />
  );
}

export type StatusKind = 'pending' | 'due-soon' | 'done' | 'problem';

/** PU00-4: the pill a newly saved offline item shows until the outbox sends it. */
export function WaitingToSyncPill({ testID }: { testID?: string } = {}) {
  return <StatusPill testID={testID} label={t('tx.waiting')} kind="pending" />;
}

export function StatusPill({ label, kind, testID }: { label: string; kind: StatusKind; testID?: string }) {
  const theme = useTheme();
  const c = tokens.color;
  const fill =
    kind === 'done' ? c.primary : kind === 'due-soon' ? c['primary-bg-subdued-hover'] : kind === 'problem' ? c.canvas : c.hairline;
  const color = kind === 'done' ? c['on-primary'] : kind === 'due-soon' ? c['primary-deep'] : kind === 'problem' ? c.ink : c['ink-secondary'];
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s['spacing-xs'],
        alignSelf: 'flex-start',
        backgroundColor: fill,
        borderRadius: r['rounded-pill'],
        borderWidth: kind === 'problem' ? 1 : 0,
        borderColor: c.hairline,
        paddingHorizontal: s['spacing-sm'],
        paddingVertical: s['spacing-xxs'],
      }}
    >
      {kind === 'problem' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.error }} /> : null}
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function PillTag({
  label,
  selected,
  onPress,
  testID,
  soft,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  /** DESIGN pill-tag-soft — subdued fill for rule chips. */
  soft?: boolean;
}) {
  const theme = useTheme();
  const fill = selected ? theme.tagFill : soft ? theme.page : theme.card;
  const border = selected ? theme.tagFill : theme.border;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'checkbox' : 'text'}
      accessibilityState={onPress ? { checked: !!selected } : undefined}
      aria-checked={onPress ? !!selected : undefined}
      accessibilityLabel={label}
      style={{
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: s['spacing-md'],
        borderRadius: r['rounded-pill'],
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text variant="caption" style={{ color: selected ? theme.tagText : theme.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  caption,
  testID,
  richLabel,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  caption?: string;
  testID?: string;
  /** Shown instead of the plain label when it holds links; kept outside the tick-box so controls don't nest. */
  richLabel?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: s['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s['spacing-sm'] }}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        aria-checked={checked}
        onPress={() => onChange(!checked)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: s['spacing-sm'], minHeight: 44, flexShrink: 1 }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: r['rounded-xs'],
            borderWidth: 1,
            borderColor: checked ? theme.primaryFill : theme.inputBorder,
            backgroundColor: checked ? theme.primaryFill : theme.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: theme.onPrimaryFill }} /> : null}
        </View>
        {richLabel ? null : <Text style={{ flexShrink: 1 }}>{label}</Text>}
      </Pressable>
      {richLabel}
      </View>
      {caption ? (
        <Text variant="caption" tone="textHelper">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

type FooterChild = ReactElement<{ kind?: string }>;

/**
 * A band's buttons. Accepts at most one filled main button (DESIGN.md 2.3, E-08).
 * Only `Button` with primary-pill/gradient counts — outline destructive confirms are not filled mains.
 */
export function Footer({ children }: { children: FooterChild | FooterChild[] }) {
  const phone = useSizeClass() === 'phone';
  const items = Children.toArray(children).filter(isValidElement) as FooterChild[];
  const primaries = items.filter((c) => {
    if (c.type !== Button) return false;
    const kind = c.props.kind ?? 'primary-pill';
    return kind === 'primary-pill' || kind === 'gradient';
  });
  if (primaries.length > 1) throw new Error('Footer accepts one main button');
  const ordered = phone ? [...primaries, ...items.filter((c) => !primaries.includes(c))] : items;
  return (
    <View
      style={{
        flexDirection: phone ? 'column' : 'row',
        justifyContent: phone ? undefined : 'space-between',
        alignItems: phone ? 'stretch' : 'center',
        gap: s['spacing-md'],
      }}
    >
      {ordered}
    </View>
  );
}

export function Divider({ label }: { label?: string }) {
  const theme = useTheme();
  const line = <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s['spacing-md'] }}>
      {line}
      {label ? (
        <Text variant="caption" tone="textHelper">
          {label}
        </Text>
      ) : null}
      {label ? line : null}
    </View>
  );
}

export function useReduceMotion(): boolean {
  return useDesign().reduceMotion;
}
