import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Amount, Button, Card, EmptyState, Placeholder, SegmentedControl, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { DividendSheet, HoldingSheet, TradeSheet, UpdatePricesSheet } from './investmentSheets';
import { holdingFigures, lotsFor, openUnits, pricesFor } from './helpers';

const sp = tokens.spacing;
type Tab = 'lots' | 'dividends' | 'trades' | 'prices';

/** TB-09 Holding page */
export function HoldingScreen() {
  const { snapshot } = useWorkspace();
  const params = useGlobalSearchParams<{ id?: string; tab?: string }>();
  const router = useRouter();
  const phone = useSizeClass() === 'phone';
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'lots');
  const [sheet, setSheet] = useState<'edit' | 'buy' | 'sell' | 'dividend' | 'prices' | null>(null);

  const holding = snapshot?.holdings.find((h) => h.id === params.id);
  const figures = snapshot && holding ? holdingFigures(snapshot, holding) : null;
  const lots = useMemo(() => (snapshot && holding ? lotsFor(snapshot, holding.id) : []), [snapshot, holding]);
  const prices = useMemo(() => (snapshot && holding ? pricesFor(snapshot, holding.id) : []), [snapshot, holding]);
  const trades = useMemo(() => {
    if (!snapshot || !holding) return [];
    return snapshot.events
      .filter(
        (e) =>
          (e.type === 'investment_buy' || e.type === 'investment_sell') &&
          e.status === 'posted' &&
          e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [snapshot, holding]);
  const dividends = useMemo(() => {
    if (!snapshot || !holding) return [];
    return snapshot.events
      .filter(
        (e) =>
          e.type === 'income' &&
          e.status === 'posted' &&
          e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId || l.ledgerAccountId.endsWith(':investment_income')),
      )
      .filter((e) => e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId) || trades.length >= 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [snapshot, holding, trades.length]);

  if (snapshot && !holding) {
    return (
      <AppFrame title={t('investments.title')}>
        <EmptyState title={t('investments.missingTitle')} body={t('investments.missingBody')} actionLabel={t('investments.back')} onAction={() => router.push('/investments')} />
      </AppFrame>
    );
  }

  const sections = (
    <>
      {(!phone || tab === 'lots') && (
        <View testID="holding-lots" style={{ gap: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('investments.lots')}</Text>
          {lots.length === 0 ? (
            <Text tone="textSecondary">{t('investments.noLots')}</Text>
          ) : (
            lots.map((lot) => {
              const open = openUnits(lot);
              const sold = open <= 0;
              return (
                <Card key={lot.id} style={{ opacity: sold ? 0.55 : 1 }}>
                  <Text>
                    {lot.date} · {lot.units} @ {formatNaira(BigInt(lot.pricePerUnitMinor))}
                  </Text>
                  <Text tone="textSecondary">
                    {t('investments.lotCost')}: {formatNaira(BigInt(lot.costMinor))}
                    {sold ? ` · ${t('investments.sold')}` : ` · ${open} ${t('investments.open')}`}
                  </Text>
                </Card>
              );
            })
          )}
        </View>
      )}
      {(!phone || tab === 'dividends') && (
        <View testID="holding-dividends" style={{ gap: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('investments.dividends')}</Text>
          {dividends.length === 0 ? <Text tone="textSecondary">{t('investments.noDividends')}</Text> : null}
          {dividends.map((e) => {
            const amount = e.lines.filter((l) => l.amountMinor > 0n).reduce((s, l) => s + l.amountMinor, 0n);
            return (
              <Card key={e.id}>
                <Text>
                  {e.date} · {formatNaira(amount)}
                </Text>
              </Card>
            );
          })}
        </View>
      )}
      {(!phone || tab === 'trades') && (
        <View testID="holding-trades" style={{ gap: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('investments.trades')}</Text>
          {trades.length === 0 ? <Text tone="textSecondary">{t('investments.noTrades')}</Text> : null}
          {trades.map((e) => (
            <Card key={e.id}>
              <Text>
                {e.date} · {e.type === 'investment_buy' ? t('investments.buy') : t('investments.sell')}
              </Text>
            </Card>
          ))}
        </View>
      )}
      {(!phone || tab === 'prices') && (
        <View testID="holding-prices" style={{ gap: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('investments.prices')}</Text>
          {prices.length === 0 ? <Text tone="textSecondary">{t('investments.noPrices')}</Text> : null}
          {prices.map((p) => (
            <Card key={p.id}>
              <Text>
                {p.date} · {formatNaira(BigInt(p.priceMinor))}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </>
  );

  return (
    <AppFrame title={holding?.name ?? t('investments.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <Button kind="link" label={t('investments.back')} onPress={() => router.push('/investments')} style={{ alignSelf: 'flex-start' }} />
        {!holding || !figures || !snapshot ? (
          <Placeholder height={120} />
        ) : (
          <>
            <Card style={{ gap: sp['spacing-sm'] }}>
              <Text tone="textSecondary">{figures.holding.symbol ?? t(`investments.type.${figures.holding.type}`)}</Text>
              <Amount minor={figures.value} variant="display-lg" />
              <Text tone="textSecondary">
                {figures.units} · {t('investments.gain')}: {formatNaira(figures.gain)}
              </Text>
            </Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
              <Button testID="holding-buy" label={t('investments.buy')} onPress={() => setSheet('buy')} />
              <Button testID="holding-sell" kind="secondary" label={t('investments.sell')} onPress={() => setSheet('sell')} />
              <Button testID="holding-dividend" kind="secondary" label={t('investments.dividend')} onPress={() => setSheet('dividend')} />
              <Button testID="holding-prices-btn" kind="secondary" label={t('investments.updatePrice')} onPress={() => setSheet('prices')} />
              <Button testID="holding-edit" kind="secondary" label={t('common.edit')} onPress={() => setSheet('edit')} />
            </View>
            {phone ? (
              <SegmentedControl
                testID="holding-tabs"
                label={t('investments.views')}
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  router.setParams({ tab: v });
                }}
                options={[
                  { value: 'lots', label: t('investments.lots') },
                  { value: 'dividends', label: t('investments.dividends') },
                  { value: 'trades', label: t('investments.trades') },
                  { value: 'prices', label: t('investments.prices') },
                ]}
              />
            ) : null}
            {sections}
          </>
        )}
      </ScrollView>
      {sheet === 'edit' && holding ? <HoldingSheet holding={holding} onClose={() => setSheet(null)} /> : null}
      {sheet === 'buy' && holding ? <TradeSheet direction="buy" holdingId={holding.id} onClose={() => setSheet(null)} /> : null}
      {sheet === 'sell' && holding ? <TradeSheet direction="sell" holdingId={holding.id} onClose={() => setSheet(null)} /> : null}
      {sheet === 'dividend' && holding ? <DividendSheet holdingId={holding.id} onClose={() => setSheet(null)} /> : null}
      {sheet === 'prices' && holding ? <UpdatePricesSheet holdingId={holding.id} onClose={() => setSheet(null)} /> : null}
    </AppFrame>
  );
}
