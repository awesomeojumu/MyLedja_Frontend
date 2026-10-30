import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, TextInput as RNTextInput, View, type TextInputProps, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '@/i18n';
import { RedesignIcon, type RedesignIconName } from './icons';
import { RedesignText, redesignTypeStyle } from './Text';
import { redesignLight as theme, redesignTokens as tokens } from './theme';

const sp = tokens.space;
const shape = tokens.shape;
const size = tokens.size;
const density = tokens.density.touch;

/** Bottom nav + floating Add fixed together (Mobile App Phone / Bottom nav). */
export function RedesignBottomNav({
  tabs,
  activeKey,
  onTab,
  onAdd,
}: {
  tabs: { key: string; label: string; icon: RedesignIconName }[];
  activeKey: string;
  onTab: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <View testID="redesign-bottom-nav" style={{ height: tokens.frame.bottomNavHeight + tokens.frame.fabOffset, justifyContent: 'flex-end' }}>
      <Pressable
        testID="redesign-fab-add"
        accessibilityRole="button"
        accessibilityLabel={t('nav.add')}
        onPress={onAdd}
        style={{
          position: 'absolute',
          alignSelf: 'center',
          top: 0,
          zIndex: 2,
          width: size['add-fab'],
          height: size['add-fab'],
          borderRadius: shape['radius-pill'],
          backgroundColor: theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: tokens.elevation['2'],
        }}
      >
        <RedesignIcon name="plus" size={size['icon-xl']} color={theme.textOnPrimary} />
      </Pressable>
      <View
        testID="redesign-tab-bar"
        role="navigation"
        style={{
          height: tokens.frame.bottomNavHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderColor: theme.border,
          paddingTop: sp.sm,
        }}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              testID={`redesign-nav-${tab.key}`}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              onPress={() => onTab(tab.key)}
              style={{
                width: size['nav-tab'],
                minHeight: density.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
                gap: sp.xxs,
              }}
            >
              <View
                style={{
                  width: size['nav-pill-w'],
                  height: size['nav-pill-h'],
                  borderRadius: shape['radius-pill'],
                  backgroundColor: active ? theme.navActivePill : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RedesignIcon name={tab.icon} size={size['icon-lg']} color={active ? theme.navActive : theme.navInactive} />
              </View>
              <RedesignText variant="nav-label" tone={active ? 'text' : 'textSecondary'}>
                {tab.label}
              </RedesignText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Top bar with ≥44px touch headroom (Figma TopBar Size=Phone). Supports menu, back, or plain title. */
export function RedesignTopBar({
  title,
  onMenu,
  onBack,
  trailing,
}: {
  title: string;
  onMenu?: () => void;
  /** Secondary pages (Investments, Bills, …): back instead of menu. */
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  const leading = onBack ? (
    <Pressable
      testID="redesign-back"
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={onBack}
      style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <RedesignIcon name="arrow-left" size={size['icon-lg']} color={theme.text} />
    </Pressable>
  ) : onMenu ? (
    <Pressable
      testID="redesign-menu"
      accessibilityRole="button"
      accessibilityLabel={t('nav.menu')}
      onPress={onMenu}
      style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <RedesignIcon name="menu" size={size['icon-lg']} color={theme.text} />
    </Pressable>
  ) : (
    <View style={{ width: sp.lg }} />
  );
  const centered = !!(onMenu || onBack);
  return (
    <View
      testID="redesign-top-bar"
      style={{
        minHeight: Math.max(size['top-bar'], tokens.frame.topBarHeadroom),
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: sp.sm,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderColor: theme.border,
        gap: sp.xs,
      }}
    >
      {leading}
      <RedesignText
        variant="headline"
        accessibilityRole="header"
        style={{ flex: 1, textAlign: centered ? 'center' : 'left' }}
      >
        {title}
      </RedesignText>
      {trailing ?? <View style={{ width: density.minTarget }} />}
    </View>
  );
}

export function RedesignSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  testID,
  dirty = false,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
  dirty?: boolean;
}) {
  const [discard, setDiscard] = useState(false);
  if (!visible && discard) setDiscard(false);
  const requestClose = () => (dirty ? setDiscard(true) : onClose());
  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose}>
        <View style={{ flex: 1, backgroundColor: `${tokens.seed.ink}73`, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={requestClose} style={{ flex: 1 }} />
          <View
            testID={testID}
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: shape['radius-lg'],
              borderTopRightRadius: shape['radius-lg'],
              maxHeight: '92%',
              paddingBottom: sp.xl,
            }}
          >
            <View style={{ alignItems: 'center', paddingVertical: sp.sm }}>
              <View style={{ width: size['handle-w'], height: size['handle-h'], borderRadius: shape['radius-pill'], backgroundColor: theme.handle }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: sp.lg, minHeight: size['control-md'] }}>
              <RedesignText variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
                {title}
              </RedesignText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={requestClose}
                style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
              >
                <RedesignIcon name="x" size={size['icon-lg']} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: sp.xl, gap: sp.lg, paddingBottom: sp.lg }}>{children}</ScrollView>
            {footer ? <View style={{ paddingHorizontal: sp.xl }}>{footer}</View> : null}
          </View>
        </View>
      </Modal>
      <RedesignDialog
        visible={discard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

export function RedesignDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive,
  testID,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: `${tokens.seed.ink}73`, justifyContent: 'center', alignItems: 'center', padding: sp.xl }}>
        <View
          testID={testID ?? 'redesign-dialog'}
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            padding: sp.xl,
            gap: sp.lg,
            boxShadow: tokens.elevation['3'],
          }}
        >
          <RedesignText variant="headline" accessibilityRole="header">
            {title}
          </RedesignText>
          <RedesignText tone="textSecondary">{body}</RedesignText>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: sp.sm }}>
            <RedesignChip label={cancelLabel ?? t('common.cancel')} onPress={onCancel} />
            <RedesignChip
              label={confirmLabel}
              selected
              onPress={onConfirm}
              testID="redesign-dialog-confirm"
              style={destructive ? { backgroundColor: theme.danger } : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type ToastItem = { id: number; message: string; onUndo?: () => void };

export function useRedesignToastController() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);
  const dismiss = (id: number) => setItems((all) => all.filter((x) => x.id !== id));
  const show = (message: string, onUndo?: () => void) => {
    const id = nextId.current++;
    setItems((all) => [...all, { id, message, onUndo }].slice(-3));
    const timer = setTimeout(
      () => {
        timers.current.delete(timer);
        dismiss(id);
      },
      onUndo ? 8000 : 4000,
    );
    timers.current.add(timer);
  };
  return { items, show, dismiss };
}

export function RedesignToastHost({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        bottom: tokens.frame.bottomNavHeight + tokens.frame.fabOffset + sp.lg,
        left: 0,
        right: 0,
        alignItems: 'center',
        gap: sp.sm,
      }}
    >
      {items.map((item) => (
        <View
          key={item.id}
          testID="redesign-toast"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: sp.md,
            backgroundColor: theme.surface,
            borderRadius: shape['radius-md'],
            paddingHorizontal: sp.lg,
            paddingVertical: sp.sm,
            boxShadow: tokens.elevation['2'],
          }}
        >
          <RedesignText>{item.message}</RedesignText>
          {item.onUndo ? (
            <Pressable
              testID="redesign-toast-undo"
              accessibilityRole="button"
              accessibilityLabel={t('common.undo')}
              onPress={() => {
                item.onUndo?.();
                onDismiss(item.id);
              }}
            >
              <RedesignText variant="label" tone="primary">
                {t('common.undo')}
              </RedesignText>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function RedesignListRow({
  title,
  subtitle,
  trailing,
  onPress,
  icon,
  testID,
  showChevron,
}: {
  title: string;
  subtitle?: string;
  trailing?: string;
  onPress?: () => void;
  icon?: RedesignIconName;
  testID?: string;
  /** Defaults to true when onPress is set. Set false for amount-trailing rows (Figma Bills). */
  showChevron?: boolean;
}) {
  const chevron = showChevron ?? !!onPress;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={{
        minHeight: size['list-row'],
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp.md,
        paddingHorizontal: sp.md,
        paddingVertical: density.rowPadY,
        borderRadius: shape['radius-md'],
      }}
    >
      <View
        style={{
          width: size.avatar,
          height: size.avatar,
          borderRadius: size.avatar / 2,
          backgroundColor: theme.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon ? (
          <RedesignIcon name={icon} size={size['icon-md']} color={theme.text} />
        ) : (
          <RedesignText variant="label">{title.slice(0, 1).toUpperCase()}</RedesignText>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <RedesignText numberOfLines={1}>{title}</RedesignText>
        {subtitle ? (
          <RedesignText variant="helper" tone="textSecondary" numberOfLines={1}>
            {subtitle}
          </RedesignText>
        ) : null}
      </View>
      {trailing ? (
        <RedesignText variant="label" style={{ fontVariant: ['tabular-nums'] }}>
          {trailing}
        </RedesignText>
      ) : null}
      {chevron ? <RedesignIcon name="chevron-right" size={size['icon-md']} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

export function RedesignChoiceCard({
  title,
  body,
  selected,
  onPress,
  testID,
}: {
  title: string;
  body?: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? theme.primarySoft : theme.surface,
        borderRadius: shape['radius-lg'],
        padding: sp.lg,
        gap: sp.xs,
        minHeight: density.minTarget,
      }}
    >
      <RedesignText variant="label">{title}</RedesignText>
      {body ? (
        <RedesignText variant="helper" tone="textSecondary">
          {body}
        </RedesignText>
      ) : null}
    </Pressable>
  );
}

export function RedesignChip({
  label,
  selected,
  onPress,
  testID,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: ViewProps['style'];
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        {
          minHeight: size['control-sm'],
          paddingHorizontal: sp.md,
          borderRadius: shape['radius-pill'],
          backgroundColor: selected ? theme.primary : theme.surface,
          borderWidth: selected ? 0 : 1,
          borderColor: theme.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: sp.xs,
        },
        style,
      ]}
    >
      {selected ? <RedesignIcon name="check" size={size['icon-sm']} color={theme.textOnPrimary} /> : null}
      <RedesignText variant="label" tone={selected ? 'textOnPrimary' : 'text'}>
        {label}
      </RedesignText>
    </Pressable>
  );
}

export function RedesignSegmented({
  options,
  value,
  onChange,
  testID,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        gap: sp.xs,
        padding: sp.xs,
        borderRadius: shape['radius-pill'],
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        minHeight: size['control-md'],
      }}
    >
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.key)}
            style={{
              flex: 1,
              minHeight: size['control-sm'] + 4,
              borderRadius: shape['radius-pill'],
              backgroundColor: selected ? theme.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RedesignText variant="label" tone={selected ? 'textOnPrimary' : 'text'}>
              {opt.label}
            </RedesignText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RedesignButton({
  label,
  onPress,
  disabled,
  kind = 'primary',
  testID,
  fullWidth,
  leading,
  accessibilityRole = 'button',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'soft' | 'link';
  testID?: string;
  fullWidth?: boolean;
  leading?: ReactNode;
  accessibilityRole?: 'button' | 'link';
}) {
  const soft = kind === 'soft';
  const secondary = kind === 'secondary';
  const link = kind === 'link';
  const bg = link ? 'transparent' : soft ? theme.primarySoft : secondary ? theme.surface : theme.primary;
  const border = secondary ? theme.borderStrong : 'transparent';
  const tone = soft || secondary || link ? ('primary' as const) : ('textOnPrimary' as const);
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: link ? density.minTarget : size['control-lg'],
        paddingHorizontal: link ? sp.md : sp.xl,
        borderRadius: shape['radius-pill'],
        backgroundColor: bg,
        borderWidth: secondary ? 1 : 0,
        borderColor: border,
        opacity: disabled ? 0.45 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: sp.sm,
        alignSelf: fullWidth || !link ? (fullWidth ? 'stretch' : undefined) : 'flex-start',
        width: fullWidth ? '100%' : undefined,
      }}
    >
      {leading}
      <RedesignText variant={link ? 'body' : 'button'} tone={tone}>
        {label}
      </RedesignText>
    </Pressable>
  );
}

export function RedesignField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  testID,
  secureTextEntry,
  autoCapitalize,
  autoComplete,
  textContentType,
  keyboardType,
  onSubmitEditing,
  autoFocus,
  showSecureToggle,
  prefix,
  trailing,
  editable = true,
  onPress,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  error?: string | null;
  placeholder?: string;
  testID?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  keyboardType?: TextInputProps['keyboardType'];
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  showSecureToggle?: boolean;
  /** e.g. ₦ before amount fields (Figma AmountInput). */
  prefix?: string;
  trailing?: ReactNode;
  editable?: boolean;
  onPress?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const secure = !!secureTextEntry && !revealed;
  const field = (
    <View
      style={{
        minHeight: size.field,
        borderWidth: 1,
        borderColor: error ? theme.danger : theme.border,
        borderRadius: shape['radius-md'],
        paddingLeft: density.fieldPadX,
        paddingRight: sp.sm,
        backgroundColor: theme.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp.sm,
      }}
    >
      {prefix ? <RedesignText tone="textSecondary">{prefix}</RedesignText> : null}
      {onPress || !editable ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          onPress={onPress}
          style={{ flex: 1, minHeight: size.field, justifyContent: 'center' }}
        >
          <RedesignText tone={value ? 'text' : 'textSecondary'}>{value || placeholder || ''}</RedesignText>
        </Pressable>
      ) : (
        <RNTextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secure}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          keyboardType={keyboardType}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          style={[
            redesignTypeStyle('body'),
            {
              flex: 1,
              minHeight: size.field,
              color: theme.text,
              paddingVertical: sp.sm,
            },
          ]}
        />
      )}
      {trailing}
      {showSecureToggle || secureTextEntry ? (
        <Pressable
          testID={testID ? `${testID}-toggle` : undefined}
          accessibilityRole="button"
          accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
          onPress={() => setRevealed((v) => !v)}
          style={{
            minWidth: density.minTarget,
            minHeight: density.minTarget,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RedesignText variant="button" tone="primary">
            {revealed ? t('redesign.hide') : t('redesign.show')}
          </RedesignText>
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <View style={{ gap: sp.xs }}>
      <RedesignText variant="label">{label}</RedesignText>
      {field}
      {error ? <RedesignInlineError message={error} /> : null}
    </View>
  );
}

/** Figma Switch — immediate settings (Components). */
export function RedesignSwitch({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: sp.md,
        minHeight: density.minTarget,
      }}
    >
      <RedesignText style={{ flex: 1 }}>{label}</RedesignText>
      <View
        style={{
          width: 48,
          height: 28,
          borderRadius: shape['radius-pill'],
          backgroundColor: value ? theme.primary : theme.surfaceMuted,
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.surface,
            alignSelf: value ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
}

/** Compact filled area line (Figma LineChart on Investments). */
export function RedesignLineChart({
  points,
  testID,
  height = 120,
}: {
  points: { value: bigint }[];
  testID?: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  if (points.length === 0) return <View testID={testID} style={{ height }} />;
  const min = points.reduce((m, p) => (p.value < m ? p.value : m), points[0]!.value);
  const max = points.reduce((m, p) => (p.value > m ? p.value : m), points[0]!.value);
  const span = max - min || 1n;
  const pad = 4;
  const step = points.length > 1 && width > 0 ? (width - pad * 2) / (points.length - 1) : 0;
  const yOf = (v: bigint) => pad + (1 - Number(((v - min) * 10_000n) / span) / 10_000) * (height - pad * 2);
  const pts =
    width > 0
      ? points.map((p, i) => ({ x: pad + i * step, y: yOf(p.value) }))
      : [];
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const first = pts[0];
  const last = pts.at(-1);
  const area = pts.length > 1 && first && last ? `${d} L${last.x},${height} L${first.x},${height} Z` : null;
  return (
    <View
      testID={testID}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
      accessibilityRole="image"
      accessibilityLabel={t('investments.valueLine')}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {area ? <Path d={area} fill={theme.primarySoft} fillOpacity={0.55} /> : null}
          {pts.length > 1 ? <Path d={d} stroke={theme.primary} strokeWidth={2} fill="none" /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

export function RedesignDividerLabel({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.lg }}>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      <RedesignText variant="label" tone="textSecondary">
        {label}
      </RedesignText>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
    </View>
  );
}

export function RedesignCheckbox({
  label,
  checked,
  onChange,
  caption,
  testID,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  caption?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', gap: sp.md, alignItems: 'flex-start', minHeight: density.minTarget }}
    >
      <View
        style={{
          width: size['icon-lg'],
          height: size['icon-lg'],
          borderRadius: shape['radius-xs'],
          borderWidth: 1.5,
          borderColor: checked ? theme.primary : theme.borderStrong,
          backgroundColor: checked ? theme.primary : theme.surface,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}
      >
        {checked ? <RedesignIcon name="check" size={size['icon-sm']} color={theme.textOnPrimary} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <RedesignText>{label}</RedesignText>
        {caption ? (
          <RedesignText variant="caption" tone="textSecondary">
            {caption}
          </RedesignText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function RedesignCodeInput({
  value,
  onChange,
  testID = 'two-factor-code',
}: {
  value: string;
  onChange: (code: string) => void;
  testID?: string;
}) {
  const refs = useRef<(ComponentRef<typeof RNTextInput> | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const handle = (index: number, text: string) => {
    const clean = text.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = (value.slice(0, index) + clean).slice(0, 6);
      onChange(next);
      refs.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const chars = digits.slice();
    chars[index] = clean;
    onChange(chars.join('').slice(0, 6));
    if (clean && index < 5) refs.current[index + 1]?.focus();
  };
  return (
    <View style={{ flexDirection: 'row', gap: sp.sm, justifyContent: 'space-between' }}>
      {digits.map((d, i) => (
        <RNTextInput
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          testID={`${testID}-${i}`}
          accessibilityLabel={t('signUp.codeDigit', { n: i + 1 })}
          value={d}
          onChangeText={(text) => handle(i, text)}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
          }}
          keyboardType="number-pad"
          textContentType={i === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          style={[
            redesignTypeStyle('code'),
            {
              width: size['control-md'],
              height: 60,
              textAlign: 'center',
              color: theme.text,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              fontVariant: ['tabular-nums'],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function RedesignInlineError({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
      <RedesignIcon name="alert" size={size['icon-sm']} color={theme.danger} />
      <RedesignText variant="helper" style={{ color: theme.danger, flexShrink: 1 }}>
        {message}
      </RedesignText>
    </View>
  );
}

export function RedesignAmount({
  text,
  hidden,
  sign,
  sizeVariant = 'amount',
  testID,
}: {
  text: string;
  hidden?: boolean;
  sign?: '+' | '−' | null;
  sizeVariant?: 'amount' | 'display' | 'body';
  testID?: string;
}) {
  // Figma amounts-hidden (e.g. Phone Transactions 13:6740) keeps the naira sign.
  const shown = hidden ? '₦ ••••••' : text;
  return (
    <RedesignText
      testID={testID}
      variant={sizeVariant}
      style={{ fontVariant: ['tabular-nums'] }}
      accessibilityLabel={hidden ? t('money.privacyLabel') : undefined}
    >
      {sign && !hidden ? `${sign}${shown}` : shown}
    </RedesignText>
  );
}

export function RedesignProgress({
  value,
  max,
  overPlan,
  testID,
}: {
  value: number;
  max: number;
  overPlan?: boolean;
  testID?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(1, value / max);
  return (
    <View style={{ gap: sp.xs }}>
      {overPlan ? (
        <View
          testID={testID ? `${testID}-over` : 'redesign-over-plan'}
          style={{
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: theme.primary,
            borderRadius: shape['radius-pill'],
            paddingHorizontal: sp.sm,
            paddingVertical: 2,
          }}
        >
          <RedesignText variant="caption">{t('redesign.overPlan')}</RedesignText>
        </View>
      ) : null}
      <View
        testID={testID}
        style={{
          height: size.progress,
          borderRadius: shape['radius-pill'],
          backgroundColor: theme.progressTrack,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(pct * 100)}%`,
            height: '100%',
            backgroundColor: overPlan ? theme.danger : theme.progressFill,
            borderRadius: shape['radius-pill'],
          }}
        />
      </View>
    </View>
  );
}

export function RedesignSkeleton({ width = '100%', height = 16, testID }: { width?: number | `${number}%`; height?: number; testID?: string }) {
  return (
    <View
      testID={testID ?? 'redesign-skeleton'}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width, height, borderRadius: shape['radius-sm'], backgroundColor: theme.border }}
    />
  );
}

export function RedesignBanner({
  message,
  testID,
  actionLabel,
  onAction,
}: {
  message: string;
  testID?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.primarySoft,
        borderRadius: shape['radius-md'],
        padding: sp.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp.md,
      }}
    >
      <RedesignIcon name="info" size={size['icon-md']} color={theme.primary} />
      <RedesignText variant="helper" style={{ flex: 1 }}>
        {message}
      </RedesignText>
      {actionLabel && onAction ? (
        <RedesignButton testID={testID ? `${testID}-action` : undefined} kind="link" label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

export function RedesignEmpty({
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tertiaryLabel?: string;
  onTertiary?: () => void;
}) {
  return (
    <View testID="redesign-empty" style={{ alignItems: 'center', gap: sp.md, padding: sp.xl }}>
      <View
        style={{
          width: size.avatar,
          height: size.avatar,
          borderRadius: size.avatar / 2,
          backgroundColor: theme.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RedesignIcon name="list" size={size['icon-lg']} color={theme.textSecondary} />
      </View>
      <RedesignText variant="headline" accessibilityRole="header">
        {title}
      </RedesignText>
      <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
        {body}
      </RedesignText>
      {secondaryLabel && onSecondary ? (
        <RedesignButton testID="redesign-empty-secondary" kind="secondary" label={secondaryLabel} onPress={onSecondary} />
      ) : null}
      <RedesignButton testID="redesign-empty-action" kind="primary" label={actionLabel} onPress={onAction} fullWidth />
      {tertiaryLabel && onTertiary ? (
        <RedesignButton testID="redesign-empty-tertiary" kind="link" label={tertiaryLabel} onPress={onTertiary} />
      ) : null}
    </View>
  );
}

export function RedesignCouldNotLoad({ onRetry }: { onRetry: () => void }) {
  return (
    <View testID="redesign-could-not-load" style={{ alignItems: 'center', gap: sp.md, padding: sp.xl }}>
      <RedesignIcon name="cloud-off" size={32} color={theme.textSecondary} />
      <RedesignText variant="headline">{t('redesign.couldNotLoad')}</RedesignText>
      <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
        {t('redesign.couldNotLoadBody')}
      </RedesignText>
      <RedesignChip label={t('common.retry')} selected onPress={onRetry} />
    </View>
  );
}

export function RedesignOfflineStrip({ message }: { message?: string } = {}) {
  return (
    <View
      testID="redesign-offline-strip"
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.primarySoft,
        paddingVertical: sp.sm,
        paddingHorizontal: sp.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp.sm,
      }}
    >
      <RedesignIcon name="cloud-off" size={size['icon-sm']} color={theme.offline} />
      <RedesignText variant="helper" tone="textSecondary" style={{ flex: 1 }}>
        {message ?? t('common.offline')}
      </RedesignText>
    </View>
  );
}

export function RedesignMoreWaysToAdd({
  doors,
  onPick,
}: {
  doors: { key: string; label: string; icon: RedesignIconName }[];
  onPick: (key: string) => void;
}) {
  return (
    <View testID="redesign-more-ways" style={{ gap: sp.sm, paddingTop: sp.md }}>
      <RedesignText variant="label" tone="textSecondary">
        {t('redesign.moreWaysToAdd')}
      </RedesignText>
      {doors.map((d) => (
        <Pressable
          key={d.key}
          testID={`redesign-door-${d.key}`}
          accessibilityRole="button"
          onPress={() => onPick(d.key)}
          style={{
            minHeight: size['control-lg'],
            flexDirection: 'row',
            alignItems: 'center',
            gap: sp.md,
            paddingHorizontal: sp.md,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: shape['radius-md'],
          }}
        >
          <RedesignIcon name={d.icon} size={size['icon-lg']} color={theme.text} />
          <RedesignText style={{ flex: 1 }}>{d.label}</RedesignText>
          <RedesignIcon name="chevron-right" size={size['icon-md']} color={theme.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

export function useDensity() {
  return useMemo(() => ({ touch: tokens.density.touch, pointer: tokens.density.pointer }), []);
}
