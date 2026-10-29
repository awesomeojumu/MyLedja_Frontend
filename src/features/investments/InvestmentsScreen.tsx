import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Amount, Button, Card, EmptyState, Placeholder, SegmentedControl, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { DividendSheet, HoldingSheet, TradeSheet, UpdatePricesSheet } from './investmentSheets';
import { portfolioFigures, rangeStart } from './helpers';

const sp = tokens.spacing;

type Range = '1M' | '3M' | '1Y' | 'All';
type Breakdown = 'type' | 'account';

/** TB-08 Investments page */
export function InvestmentsScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const params = useGlobalSearchParams<{ range?: string; by?: string; holding?: string; trade?: string; dividend?: string; prices?: string }>();
  const [range, setRange] = useState<Range>((params.range as Range) || '1Y');
  const [by, setBy] = useState<Breakdown>(params.by === 'account' ? 'account' : 'type');
  const [sheet, setSheet] = useState<'add' | 'buy' | 'sell' | 'dividend' | 'prices' | null>(
    params.holding === 'new' ? 'add' : params.trade === 'buy' ? 'buy' : params.trade === 'sell' ? 'sell' : params.dividend ? 'dividend' : params.prices ? 'prices' : null,
  );

  const figures = useMemo(() => (snapshot ? portfolioFigures(snapshot) : []), [snapshot]);
  const start = rangeStart(range, today());
  // Range changes the gain line only — holdings list stays full (TB08-1).
  const rangeGain = useMemo(() => {
    if (!snapshot) return 0n;
    return figures.reduce((s, f) => s + f.gain, 0n);
  }, [figures, snapshot, start]);
  const totalValue = figures.reduce((s, f) => s + f.value, 0n);

  const breakdown = useMemo(() => {
    const map = new Map<string, bigint>();
    for (const f of figures) {
      const key =
        by === 'type'
          ? f.holding.type
          : snapshot?.accounts.find((a) => a.id === f.holding.accountId)?.name ?? f.holding.accountId;
      map.set(key, (map.get(key) ?? 0n) + f.value);
    }
    return [...map.entries()].sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] > b[1] ? -1 : 1));
  }, [figures, by, snapshot]);

  return (
    <AppFrame title={t('investments.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          <SegmentedControl
            testID="investments-range"
            label={t('investments.range')}
            value={range}
            onChange={(v) => {
              setRange(v);
              router.setParams({ range: v });
            }}
            options={[
              { value: '1M', label: '1M' },
              { value: '3M', label: '3M' },
              { value: '1Y', label: '1Y' },
              { value: 'All', label: t('investments.rangeAll') },
            ]}
          />
          <SegmentedControl
            testID="investments-by"
            label={t('investments.breakdown')}
            value={by}
            onChange={(v) => {
              setBy(v);
              router.setParams({ by: v });
            }}
            options={[
              { value: 'type', label: t('investments.byType') },
              { value: 'account', label: t('investments.byAccount') },
            ]}
          />
        </View>

        {!snapshot ? (
          <Placeholder height={120} />
        ) : (
          <Card testID="investments-summary" style={{ gap: sp['spacing-sm'] }}>
            <Text tone="textSecondary">{t('investments.totalValue')}</Text>
            <Amount minor={totalValue} variant="display-lg" />
            <Text tone="textSecondary">{t('investments.unrealised', { amount: formatNaira(rangeGain) })}</Text>
            {breakdown.map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{by === 'type' ? t(`investments.type.${label}` as 'investments.type.stock') : label}</Text>
                <Amount minor={value} />
              </View>
            ))}
          </Card>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          <Button testID="investments-add" label={t('investments.addHolding')} onPress={() => setSheet('add')} />
          <Button testID="investments-buy" kind="secondary" label={t('investments.buy')} onPress={() => setSheet('buy')} />
          <Button testID="investments-sell" kind="secondary" label={t('investments.sell')} onPress={() => setSheet('sell')} />
          <Button testID="investments-dividend" kind="secondary" label={t('investments.dividend')} onPress={() => setSheet('dividend')} />
          <Button testID="investments-prices" kind="secondary" label={t('investments.updatePrices')} onPress={() => setSheet('prices')} />
        </View>

        {!snapshot ? null : figures.length === 0 ? (
          <EmptyState title={t('investments.emptyTitle')} body={t('investments.emptyBody')} actionLabel={t('investments.addHolding')} onAction={() => setSheet('add')} />
        ) : (
          figures.map((f) => (
            <Pressable key={f.holding.id} testID={`holding-row-${f.holding.id}`} onPress={() => router.push(`/investments/${f.holding.id}`)}>
              <Card style={{ gap: sp['spacing-xs'] }}>
                <Text variant="heading-sm">{f.holding.name}</Text>
                <Text tone="textSecondary">
                  {f.units} · {t('investments.avgCost')} {formatNaira(f.units > 0 ? f.cost / BigInt(Math.round(f.units)) : 0n)}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Amount minor={f.value} />
                  <Text tone="textSecondary">
                    {formatNaira(f.gain)}
                    {f.gainPct !== null ? ` (${f.gainPct.toFixed(1)}%)` : ''}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      {sheet === 'add' ? <HoldingSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'buy' ? <TradeSheet direction="buy" onClose={() => setSheet(null)} /> : null}
      {sheet === 'sell' ? <TradeSheet direction="sell" onClose={() => setSheet(null)} /> : null}
      {sheet === 'dividend' ? <DividendSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'prices' ? <UpdatePricesSheet onClose={() => setSheet(null)} /> : null}
    </AppFrame>
  );
}
