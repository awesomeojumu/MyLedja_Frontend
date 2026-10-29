import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import type { Account } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatUnits } from '@/ledger';
import { formatMoney, PRIVACY_MASK } from '@/money';

import { holdingRows } from './helpers';
import { HoldingSheet } from './investmentSheets';

const sp = tokens.spacing;

/** P09-09: an investment account lists each holding with units, cost, price, value and gain. */
export function HoldingsTab({ snapshot, account }: { snapshot: Snapshot; account: Account }) {
  const router = useRouter();
  const theme = useTheme();
  const { privacy } = useDesign();
  const [adding, setAdding] = useState(false);
  const rows = holdingRows(snapshot, today()).filter((r) => r.holding.accountId === account.id && !r.holding.archived);
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : formatMoney(v, account.currency));
  return (
    <Card testID="holdings-tab" style={{ gap: sp['spacing-sm'] }}>
      {rows.length === 0 ? <Text tone="textSecondary">{t('investments.accountEmpty')}</Text> : null}
      {rows.length ? (
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
          {[t('investments.col.holding'), t('investments.col.units'), t('investments.cost'), t('investments.col.price'), t('investments.col.value'), t('investments.col.gain')].map((h) => (
            <Text key={h} variant="caption" tone="textSecondary" style={{ flex: 1 }}>
              {h}
            </Text>
          ))}
        </View>
      ) : null}
      {rows.map((r) => (
        <Pressable
          key={r.holding.id}
          testID={`account-holding-${r.holding.id}`}
          accessibilityRole="button"
          accessibilityLabel={t('investments.rowLabel', { name: r.holding.name, value: show(r.position.value), gain: show(r.position.unrealised) })}
          onPress={() => router.push(`/investments/${r.holding.id}`)}
          style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border }}
        >
          <Text style={{ flex: 1 }}>{r.holding.name}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{formatUnits(r.position.units)}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{show(r.position.cost)}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{r.position.price ? show(r.position.price.priceMinor) : ''}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{show(r.position.value)}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{privacy ? PRIVACY_MASK : formatMoney(r.position.unrealised, account.currency, { signed: true })}</Text>
        </Pressable>
      ))}
      <Button testID="account-add-holding" kind="secondary" label={t('investments.addHolding')} onPress={() => setAdding(true)} />
      {adding ? <HoldingSheet onClose={() => setAdding(false)} /> : null}
    </Card>
  );
}
