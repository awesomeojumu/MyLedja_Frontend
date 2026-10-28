import { Pressable, View } from 'react-native';

import { Amount, Button, Card, StatusPill, Text, formatDay } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { type GoalCard, goalStatusKind, statusPillFor } from './helpers';

const sp = tokens.spacing;

export function GoalCardView({
  card,
  today,
  onOpen,
  onAllocate,
}: {
  card: GoalCard;
  today: string;
  onOpen: () => void;
  onAllocate: () => void;
}) {
  const theme = useTheme();
  const kind = goalStatusKind(card, today);
  const pill = statusPillFor(kind);
  const done = kind === 'done';
  const pct = Math.round(card.progress * 100);

  return (
    <Card testID={`goal-${card.goal.id}`} style={{ gap: sp['spacing-sm'], flexGrow: 1 }}>
      <Pressable accessibilityRole="button" onPress={onOpen}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading-sm">{card.goal.name}</Text>
          <StatusPill label={t(pill.labelKey)} kind={pill.pill} />
        </View>
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
