import { Pressable, View } from 'react-native';
import { GraduationCap, Home, Laptop, MoreHorizontal, PiggyBank, Plane, Target } from 'lucide-react-native';

import { Amount, Button, Card, Icon, Menu, StatusPill, Text, formatDay } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { type GoalCard, goalStatusKind, statusPillFor } from './helpers';

const sp = tokens.spacing;

const ICON_MAP = {
  target: Target,
  piggy: PiggyBank,
  home: Home,
  laptop: Laptop,
  plane: Plane,
  school: GraduationCap,
} as const;

export function GoalCardView({
  card,
  today,
  onOpen,
  onAllocate,
  onMenu,
}: {
  card: GoalCard;
  today: string;
  onOpen: () => void;
  onAllocate: () => void;
  onMenu?: (key: 'edit' | 'schedule' | 'delete') => void;
}) {
  const theme = useTheme();
  const kind = goalStatusKind(card, today);
  const pill = statusPillFor(kind);
  const done = kind === 'done';
  const pct = Math.round(card.progress * 100);
  const iconKey = (card.goal.icon ?? 'target') as keyof typeof ICON_MAP;
  const Glyph = ICON_MAP[iconKey] ?? Target;

  return (
    <Card
      testID={`goal-${card.goal.id}`}
      style={{ gap: sp['spacing-sm'], flexGrow: 1, opacity: done ? 0.72 : 1 }}
    >
      <Pressable accessibilityRole="button" onPress={onOpen}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], flex: 1 }}>
            <Icon icon={Glyph} size="nav" color={theme.textSecondary} />
            <Text variant="heading-sm" style={{ flexShrink: 1 }}>
              {card.goal.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
            <StatusPill label={t(pill.labelKey)} kind={pill.pill} />
            {onMenu && !done ? (
              <Menu
                testID={`goal-card-menu-${card.goal.id}`}
                trigger={(open) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.options')}
                    onPress={open}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon icon={MoreHorizontal} size="nav" color={theme.textSecondary} />
                  </Pressable>
                )}
                items={[
                  { key: 'edit', label: t('goals.editGoal'), onPress: () => onMenu('edit') },
                  { key: 'schedule', label: card.goal.scheduleAmountMinor ? t('goals.editSchedule') : t('goals.addSchedule'), onPress: () => onMenu('schedule') },
                  { key: 'delete', label: t('goals.deleteGoal'), onPress: () => onMenu('delete') },
                ]}
              />
            ) : null}
          </View>
        </View>
        {done && card.goal.completedAt ? (
          <Text variant="caption" tone="textSecondary" testID={`goal-done-date-${card.goal.id}`}>
            {formatDay(card.goal.completedAt.slice(0, 10))}
          </Text>
        ) : null}
        <Text tone="textSecondary">
          <Amount minor={card.saved} variant="caption" /> {t('goals.of')} <Amount minor={card.target} variant="caption" />
        </Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden', marginVertical: sp['spacing-xs'] }}>
          <View style={{ height: 8, width: `${pct}%`, backgroundColor: theme.primaryFill }} />
        </View>
        <Text variant="caption" tone="textSecondary">
          {t('goals.percentProgress', { percent: String(pct) })}
        </Text>
        {card.goal.targetDate ? (
          <Text variant="caption" tone="textSecondary">
            {t('goals.byDate', { date: formatDay(card.goal.targetDate) })}
            {card.monthly ? ` · ${t('goals.perMonth', { amount: formatNaira(card.monthly) })}` : ''}
          </Text>
        ) : null}
        <Text variant="caption" tone="textSecondary">
          {t('goals.inAccount', { name: card.accountName })}
        </Text>
      </Pressable>
      {done ? null : (
        <Button testID={`goal-allocate-${card.goal.id}`} kind="secondary" label={t('goals.addMoney')} onPress={onAllocate} />
      )}
    </Card>
  );
}
