import { useMemo, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';

import {
  RedesignButton,
  RedesignIcon,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useSizeClass } from '@/design/size';
import type { AppNotification } from '@/data/workspace/model';
import { formatNaira } from '@/money';
import { t } from '@/i18n';

import { formatRedesignNotificationWhen, redesignNotificationSubtitle } from './redesignHelpers';

const sp = tokens.space;
const shape = tokens.shape;
const size = tokens.size;

function PhoneSwipe({
  enabled,
  onDismiss,
  children,
}: {
  enabled: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          enabled && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) setDx(Math.max(g.dx, -160));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -72) onDismiss();
          setDx(0);
        },
        onPanResponderTerminate: () => setDx(0),
      }).panHandlers,
    [enabled, onDismiss],
  );

  if (!enabled) return <>{children}</>;
  return (
    <View testID="notification-swipe" collapsable={false} style={{ transform: [{ translateX: dx }] }} {...panHandlers}>
      {children}
    </View>
  );
}

function avatarLetter(title: string): string {
  const ch = title.trim().charAt(0);
  return ch ? ch.toUpperCase() : 'A';
}

function subtitleFor(n: AppNotification): string | undefined {
  const body = redesignNotificationSubtitle(n);
  if (body) return body;
  if (n.amountMinor && n.category === 'bills') return formatNaira(BigInt(n.amountMinor));
  return undefined;
}

/** Figma Mobile Phone / Notifications row (2:1156). */
export function RedesignNotificationRow({
  notification: n,
  today,
  selected,
  onSelect,
  onPrimary,
  onSecurityYes,
  onSecurityNo,
  onDismiss,
}: {
  notification: AppNotification;
  today: string;
  selected?: boolean;
  onSelect?: () => void;
  onPrimary: () => void;
  onSecurityYes: () => void;
  onSecurityNo: () => void;
  onDismiss: () => void;
}) {
  const phone = useSizeClass() === 'phone';
  const when = formatRedesignNotificationWhen(n.createdAt, today);
  const subtitle = subtitleFor(n);
  const canSwipe = phone && n.category !== 'security';
  const unread = !n.read;

  const row = (
    <Pressable
      testID={`notification-${n.id}`}
      accessibilityRole="button"
      onPress={() => {
        onSelect?.();
        if (n.category !== 'security') onPrimary();
      }}
      style={{
        minHeight: size['list-row'],
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp.md,
        paddingVertical: sp.md,
        paddingHorizontal: sp.md,
        backgroundColor: selected || unread ? theme.primarySoft : 'transparent',
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
        <RedesignText variant="label">{avatarLetter(n.title)}</RedesignText>
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: sp.sm }}>
          <RedesignText variant="body-medium" style={{ flex: 1 }} numberOfLines={2}>
            {n.title}
          </RedesignText>
          <RedesignText variant="helper" style={{ fontVariant: ['tabular-nums'] }}>
            {when}
          </RedesignText>
        </View>
        {subtitle ? (
          <RedesignText variant="caption" tone="textSecondary" numberOfLines={2}>
            {subtitle}
          </RedesignText>
        ) : null}
        {n.category === 'security' ? (
          <View style={{ flexDirection: 'row', gap: sp.sm, marginTop: sp.xs }}>
            <RedesignButton
              testID={`notification-security-yes-${n.id}`}
              kind="secondary"
              label={t('notifications.securityYes')}
              onPress={onSecurityYes}
            />
            <RedesignButton
              testID={`notification-security-no-${n.id}`}
              kind="link"
              label={t('notifications.securityNo')}
              onPress={onSecurityNo}
            />
          </View>
        ) : null}
      </View>
      <RedesignIcon name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );

  return (
    <PhoneSwipe enabled={canSwipe} onDismiss={onDismiss}>
      {row}
    </PhoneSwipe>
  );
}
