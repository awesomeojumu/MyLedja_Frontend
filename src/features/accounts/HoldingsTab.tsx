import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, EmptyState, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Account } from '@/data/workspace/model';
import { t } from '@/i18n';

const sp = tokens.spacing;

/** Holdings tab shell for investment accounts (full holdings ship Phase 5 / page 17). */
export function HoldingsTab({ account }: { account: Account }) {
  const theme = useTheme();
  const [action, setAction] = useState<'buy' | 'sell' | 'dividend' | 'add' | null>(null);
  return (
    <View style={{ gap: sp['spacing-md'] }} testID="holdings-tab">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
        <Button testID="holding-buy" kind="secondary" label={t('account.holdings.buy')} onPress={() => setAction('buy')} />
        <Button testID="holding-sell" kind="secondary" label={t('account.holdings.sell')} onPress={() => setAction('sell')} />
        <Button testID="holding-dividend" kind="secondary" label={t('account.holdings.dividend')} onPress={() => setAction('dividend')} />
        <Button testID="holding-add" kind="secondary" label={t('account.holdings.add')} onPress={() => setAction('add')} />
      </View>
      <Card style={{ padding: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            padding: sp['spacing-md'],
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            gap: sp['spacing-sm'],
          }}
        >
          <Text style={{ flex: 2 }} variant="caption" tone="textSecondary">
            {t('account.holdings.name')}
          </Text>
          <Text style={{ flex: 1 }} variant="caption" tone="textSecondary">
            {t('account.holdings.units')}
          </Text>
          <Text style={{ flex: 1 }} variant="caption" tone="textSecondary">
            {t('account.holdings.value')}
          </Text>
        </View>
        <EmptyState title={t('account.holdings.emptyTitle')} body={t('account.holdings.emptyBody', { name: account.name })} />
      </Card>
      {action ? (
        <Sheet visible testID="holding-action-sheet" title={t(`account.holdings.${action}`)} onClose={() => setAction(null)}>
          <Text tone="textSecondary">{t('account.holdings.phaseNote')}</Text>
        </Sheet>
      ) : null}
    </View>
  );
}
