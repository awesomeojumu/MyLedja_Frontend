/* Surfaces and feedback: Card, SectionHeader, Sheet, Dialog, Banner, Toast, EmptyState, Skeleton. */
import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Rise } from '../motion';
import { spring } from '../tokens';
import { IconName } from '../icons';
import { Icon, toneSoft, Tone, Txt } from './foundations';
import { Button, IconButton } from './actions';

export interface CardProps { title?: string; action?: React.ReactNode; flat?: boolean; style?: StyleProp<ViewStyle>; delay?: number; children?: React.ReactNode }
export function Card({ title, action, flat, style, delay = 0, children }: CardProps) {
  const t = useTheme();
  return (
    <Rise delay={delay} style={[{ backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, padding: t.space.space4, gap: 12 },
      flat ? null : { shadowColor: '#131a2b', shadowOpacity: t.scheme === 'dark' ? 0 : 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: t.scheme === 'dark' ? 0 : 1 }, style]}>
      {title || action ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt variant="titleSm" accessibilityRole="header">{title}</Txt>{action}
        </View>
      ) : null}
      {children}
    </Rise>
  );
}

export interface SectionHeaderProps { title: string; meta?: string; level?: 1 | 2; action?: { label: string; onPress?: () => void } }
export function SectionHeader({ title, meta, level = 2, action }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 }}>
      <Txt variant={level === 1 ? 'titleLg' : 'titleMd'} accessibilityRole="header" style={{ flex: 1, fontWeight: '700' }}>{title}</Txt>
      {meta ? <Txt variant="caption" color={t.c.inkMuted}>{meta}</Txt> : null}
      {action ? <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={12}><Txt variant="label" color={t.c.primary} style={{ fontWeight: '600' }}>{action.label}</Txt></Pressable> : null}
    </View>
  );
}

export interface SheetProps { title: string; open: boolean; onClose: () => void; footer?: React.ReactNode; children?: React.ReactNode }
/** Bottom sheet on phones; centred pop-up (480 wide) on tablets and larger. Back button and scrim close it. */
export function Sheet({ title, open, onClose, footer, children }: SheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const centred = t.widthClass !== 'compact';
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) { v.setValue(0); return; }
    if (t.reduceMotion) { v.setValue(1); return; }
    Animated.spring(v, { toValue: 1, useNativeDriver: true, ...spring.sheet }).start();
  }, [open]);
  const panel = centred
    ? { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }
    : { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }], opacity: v };
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: centred ? 'center' : 'flex-end', alignItems: 'center', padding: centred ? 24 : 0 }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.c.scrim, opacity: v }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View accessibilityViewIsModal style={[{ width: '100%', maxWidth: centred ? 480 : undefined, maxHeight: centred ? '85%' : '90%', backgroundColor: t.c.surface,
          borderRadius: t.radius.radiusLg, borderBottomLeftRadius: centred ? t.radius.radiusLg : 0, borderBottomRightRadius: centred ? t.radius.radiusLg : 0,
          paddingBottom: centred ? 0 : insets.bottom }, panel]}>
          {centred ? null : <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 999, backgroundColor: t.c.borderStrong, marginTop: 8 }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, paddingVertical: 8 }}>
            <Txt variant="titleMd" accessibilityRole="header">{title}</Txt>
            <IconButton icon="x" label="Close" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 16 }}>{children}</ScrollView>
          {footer ? <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: t.c.border }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface DialogProps { title: string; open: boolean; onClose: () => void; onConfirm?: () => void; confirmLabel?: string; cancelLabel?: string; tone?: 'default' | 'destructive'; children?: React.ReactNode }
/** Only for actions Undo can't bring back (deleting an account or a workspace). */
export function Dialog({ title, open, onClose, onConfirm, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', children }: DialogProps) {
  const t = useTheme();
  const destructive = tone === 'destructive';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.c.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 400, backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, padding: 24, gap: 12 }}>
          {destructive ? <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: t.c.dangerSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash-2" size={22} color={t.c.danger} /></View> : null}
          <Txt variant="titleMd" accessibilityRole="header">{title}</Txt>
          {children ? <Txt color={t.c.inkMuted}>{children}</Txt> : null}
          <View style={{ flexDirection: t.widthClass === 'compact' ? 'column-reverse' : 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <Button variant="secondary" fullWidth={t.widthClass === 'compact'} onPress={onClose}>{cancelLabel}</Button>
            <Button variant={destructive ? 'destructive' : 'primary'} fullWidth={t.widthClass === 'compact'} onPress={onConfirm}>{confirmLabel}</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const BANNER_ICON: Record<string, IconName> = { primary: 'info', positive: 'circle-check', warning: 'triangle-alert', danger: 'circle-alert', neutral: 'wifi-off' };
export interface BannerProps { tone?: 'neutral' | 'primary' | 'positive' | 'warning' | 'danger'; title?: string; icon?: IconName; action?: { label: string; onPress?: () => void }; children?: React.ReactNode }
export function Banner({ tone = 'primary', title, icon, action, children }: BannerProps) {
  const t = useTheme();
  const { fg, bg } = toneSoft(t, tone as Tone);
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : 'summary'} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: t.radius.radiusMd, backgroundColor: bg }}>
      <Icon name={icon ?? BANNER_ICON[tone]} size={18} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Txt variant="label" style={{ fontWeight: '600' }}>{title}</Txt> : null}
        {children ? <Txt variant="bodySm">{children}</Txt> : null}
      </View>
      {action ? <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={10}><Txt variant="label" color={t.c.primary} style={{ fontWeight: '600' }}>{action.label}</Txt></Pressable> : null}
    </View>
  );
}

export interface ToastProps { message: string; tone?: 'neutral' | 'pending' | 'danger'; action?: { label: string; onPress?: () => void }; onClose?: () => void }
/** In-app confirmation. Phones: above the floating nav. Success 4s (6s with Undo). */
export function Toast({ message, tone = 'neutral', action, onClose }: ToastProps) {
  const t = useTheme();
  const ic: IconName = tone === 'danger' ? 'circle-alert' : tone === 'pending' ? 'clock' : 'circle-check';
  return (
    <Rise>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: t.radius.radiusMd, backgroundColor: t.c.ink }}>
        <Icon name={ic} size={18} color={t.c.bg} />
        <Text style={[t.text('bodySm'), { flex: 1, color: t.c.bg }]}>{message}</Text>
        {action ? <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={10}><Text style={[t.text('label'), { color: t.c.bg, fontWeight: '700' }]}>{action.label}</Text></Pressable> : null}
        {onClose ? <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10}><Icon name="x" size={16} color={t.c.bg} /></Pressable> : null}
      </View>
    </Rise>
  );
}

export interface EmptyStateProps { title: string; icon?: IconName; action?: { label: string; icon?: IconName; onPress?: () => void }; children?: React.ReactNode }
export function EmptyState({ title, icon = 'inbox', action, children }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 }}>
      <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: t.c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name={icon} size={24} color={t.c.onPrimarySoft} />
      </View>
      <Txt variant="titleMd" style={{ textAlign: 'center' }}>{title}</Txt>
      {children ? <Txt color={t.c.inkMuted} style={{ textAlign: 'center', marginBottom: 12 }}>{children}</Txt> : null}
      {action ? <Button icon={action.icon} onPress={action.onPress}>{action.label}</Button> : null}
    </View>
  );
}

/** Placeholder in the shape of what is loading. Pulses with opacity; still under reduce-motion. */
export function Skeleton({ variant = 'text', lines = 1 }: { variant?: 'text' | 'amount' | 'row' | 'card'; lines?: number }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (t.reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t.reduceMotion]);
  const bar = (w: any, h = 12, key?: number) => <Animated.View key={key} style={{ width: w, height: h, borderRadius: t.radius.radiusSm, backgroundColor: t.c.surfaceAlt, opacity: v }} />;
  return (
    <View importantForAccessibility="no-hide-descendants">
      {variant === 'row' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
          <Animated.View style={{ width: 40, height: 40, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt, opacity: v }} />
          <View style={{ flex: 1, gap: 6 }}>{bar('55%')}{bar('35%', 10)}</View>{bar(72)}
        </View>
      ) : variant === 'card' ? (
        <View style={{ gap: 12, padding: 16, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, backgroundColor: t.c.surface }}>{bar('40%', 10)}{bar('70%', 24)}{bar('30%', 10)}</View>
      ) : (
        <View style={{ gap: 8 }}>{Array.from({ length: lines }).map((_, i) => bar(i === lines - 1 && lines > 1 ? '60%' : '100%', variant === 'amount' ? 24 : 12, i))}</View>
      )}
    </View>
  );
}

/** Android back closes the topmost open layer first. Use in screens that hold sheets. */
export function useBackToClose(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [open, close]);
}
