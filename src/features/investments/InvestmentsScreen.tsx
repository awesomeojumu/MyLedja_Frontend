import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  DonutChart,
  EmptyState,
  LineChart,
  Placeholder,
  SegmentedControl,
  Text,
} from '@/design/components';
import { useSizeClass } from '@/design/size';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { DividendSheet, HoldingSheet, TradeSheet, UpdatePricesSheet } from './investmentSheets';
import { formatGain, isDown, portfolioSummary, type HoldingFigures } from './helpers';

const sp = tokens.spacing;
const ruby = tokens.color.ruby;

type Range = '1M' | '3M' | '1Y' | 'All';
type Breakdown = 'type' | 'account';
type SortKey = 'name' | 'account' | 'units' | 'avgCost' | 'price' | 'value' | 'gain';

function todayLagos() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

function GainCell({ f }: { f: HoldingFigures }) {
  const down = isDown(f.gainPct);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
      {down ? (
        <View testID={`holding-down-${f.holding.id}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ruby }} />
      ) : null}
      <Text tone="textSecondary" style={down ? { color: ruby } : undefined}>
        {formatGain(f.gain, f.gainPct)}
        {down ? ` ${t('investments.down')}` : ''}
      </Text>
    </View>
  );
}

/** TB-08 Investments page */
export function InvestmentsScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const theme = useTheme();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const portrait = height >= width;
  const phone = size === 'phone';
  const tablet = size === 'tablet';
  const showTable = !phone;

  const params = useGlobalSearchParams<{
    range?: string;
    by?: string;
    holding?: string;
    trade?: string;
    dividend?: string;
    prices?: string;
  }>();
  const [range, setRange] = useState<Range>((params.range as Range) || '1Y');
  const [by, setBy] = useState<Breakdown>(params.by === 'account' ? 'account' : 'type');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'value', dir: -1 });
  const [sheet, setSheet] = useState<'add' | 'buy' | 'sell' | 'dividend' | 'prices' | null>(
    params.holding === 'new'
      ? 'add'
      : params.trade === 'buy'
        ? 'buy'
        : params.trade === 'sell'
          ? 'sell'
          : params.dividend
            ? 'dividend'
            : params.prices
              ? 'prices'
              : null,
  );
  const [pendingTradeId, setPendingTradeId] = useState<string | null>(null);

  const paramHolding =
    typeof params.holding === 'string' && params.holding !== 'new' ? params.holding : undefined;
  const dividendHoldingId =
    typeof params.dividend === 'string' && params.dividend !== '1' ? params.dividend : paramHolding;

  const summary = useMemo(
    () => (snapshot ? portfolioSummary(snapshot, range, todayLagos()) : null),
    [snapshot, range],
  );

  const sorted = useMemo(() => {
    if (!summary) return [];
    const rows = [...summary.figures];
    const accountName = (id: string) => snapshot?.accounts.find((a) => a.id === id)?.name ?? id;
    rows.sort((a, b) => {
      const dir = sort.dir;
      switch (sort.key) {
        case 'name':
          return dir * a.holding.name.localeCompare(b.holding.name);
        case 'account':
          return dir * accountName(a.holding.accountId).localeCompare(accountName(b.holding.accountId));
        case 'units':
          return dir * (a.units - b.units);
        case 'avgCost': {
          const aa = a.units > 0 ? a.cost / BigInt(Math.round(a.units)) : 0n;
          const bb = b.units > 0 ? b.cost / BigInt(Math.round(b.units)) : 0n;
          return dir * (aa === bb ? 0 : aa > bb ? 1 : -1);
        }
        case 'price': {
          const aa = a.price ?? -1n;
          const bb = b.price ?? -1n;
          return dir * (aa === bb ? 0 : aa > bb ? 1 : -1);
        }
        case 'gain':
          return dir * (a.gain === b.gain ? 0 : a.gain > b.gain ? 1 : -1);
        case 'value':
        default:
          return dir * (a.value === b.value ? 0 : a.value > b.value ? 1 : -1);
      }
    });
    return rows;
  }, [summary, sort, snapshot]);

  const hideAvgAndPrice = tablet && portrait;

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'account' ? 1 : -1 },
    );
  };

  const closeSheet = () => {
    setSheet(null);
    setPendingTradeId(null);
    router.setParams({ holding: undefined, trade: undefined, dividend: undefined, prices: undefined });
  };

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

        {!summary ? (
          <Placeholder height={120} />
        ) : (
          <Card testID="investments-summary" style={{ gap: sp['spacing-sm'] }}>
            <Text tone="textSecondary">{t('investments.totalValue')}</Text>
            <Amount minor={summary.totalValue} variant="display-lg" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
              <Text testID="portfolio-unrealised" tone="textSecondary">
                {t('investments.unrealisedLabel')}: {formatGain(summary.unrealised, summary.gainPct)}
              </Text>
              <Text testID="portfolio-realised" tone="textSecondary">
                {t('investments.realised')}: {formatGain(summary.realised, null)}
              </Text>
              <Text testID="portfolio-dividends" tone="textSecondary">
                {t('investments.dividends')}: {formatNaira(summary.dividends)}
              </Text>
            </View>
            {summary.series.length > 0 ? (
              <LineChart
                testID="investments-value-line"
                title={t('investments.valueLine')}
                columns={[t('common.date'), t('investments.value')]}
                rows={summary.series.map((p) => ({ label: p.date, value: p.value }))}
                goldLatest
              />
            ) : null}
            {by === 'type' && summary.byType.length > 0 ? (
              <DonutChart
                testID="investments-donut"
                title={t('investments.byType')}
                columns={[t('investments.type'), t('investments.value')]}
                total={summary.totalValue}
                rows={summary.byType.map((r) => ({
                  label: t(`investments.type.${r.key}` as 'investments.type.stock'),
                  value: r.value,
                }))}
              />
            ) : (
              <View testID="investments-by-account" style={{ gap: sp['spacing-xs'] }}>
                {summary.byAccount.map((r) => (
                  <View key={r.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text>{r.label}</Text>
                    <Amount minor={r.value} />
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          <Button testID="investments-add" label={t('investments.addHolding')} onPress={() => setSheet('add')} />
          <Button
            testID="investments-prices"
            kind="secondary"
            label={t('investments.updatePrices')}
            onPress={() => setSheet('prices')}
          />
        </View>

        {!summary ? null : summary.figures.length === 0 ? (
          <EmptyState
            title={t('investments.emptyTitle')}
            body={t('investments.emptyBody')}
            actionLabel={t('investments.addHolding')}
            onAction={() => setSheet('add')}
          />
        ) : showTable ? (
          <Card testID="investments-table" style={{ gap: sp['spacing-xs'] }}>
            <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingBottom: sp['spacing-xs'] }}>
              {(
                [
                  ['name', t('investments.holding')],
                  ['account', t('investments.accountCol')],
                  ['units', t('investments.units')],
                  ...(!hideAvgAndPrice
                    ? ([
                        ['avgCost', t('investments.avgCost')],
                        ['price', t('investments.price')],
                      ] as const)
                    : []),
                  ['value', t('investments.value')],
                  ['gain', t('investments.gain')],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  testID={`sort-${key}`}
                  onPress={() => toggleSort(key)}
                  style={{ flex: key === 'name' || key === 'account' ? 1.4 : 1 }}
                >
                  <Text variant="caption" tone="textSecondary">
                    {label}
                    {sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            {sorted.map((f) => {
              const account = snapshot?.accounts.find((a) => a.id === f.holding.accountId)?.name ?? '';
              const avg = f.units > 0 ? f.cost / BigInt(Math.round(f.units)) : 0n;
              return (
                <Pressable
                  key={f.holding.id}
                  testID={`holding-row-${f.holding.id}`}
                  onPress={() => router.push(`/investments/${f.holding.id}`)}
                  style={{
                    flexDirection: 'row',
                    gap: sp['spacing-sm'],
                    paddingVertical: sp['spacing-xs'],
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                  }}
                >
                  <Text style={{ flex: 1.4 }}>{f.holding.name}</Text>
                  <Text style={{ flex: 1.4 }} tone="textSecondary">
                    {account}
                  </Text>
                  <Text style={{ flex: 1 }}>{f.units}</Text>
                  {!hideAvgAndPrice ? (
                    <>
                      <Text style={{ flex: 1 }}>{formatNaira(avg)}</Text>
                      <Text style={{ flex: 1 }}>{f.price !== null ? formatNaira(f.price) : '—'}</Text>
                    </>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Amount minor={f.value} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <GainCell f={f} />
                  </View>
                </Pressable>
              );
            })}
            <View
              testID="investments-total-row"
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: sp['spacing-sm'],
                borderTopWidth: 1,
                borderTopColor: theme.border,
              }}
            >
              <Text variant="heading-sm">{t('investments.total')}</Text>
              <View style={{ flexDirection: 'row', gap: sp['spacing-md'] }}>
                <Amount minor={summary.totalValue} />
                <Text>{formatGain(summary.unrealised, summary.gainPct)}</Text>
              </View>
            </View>
          </Card>
        ) : (
          sorted.map((f) => (
            <Pressable
              key={f.holding.id}
              testID={`holding-row-${f.holding.id}`}
              onPress={() => router.push(`/investments/${f.holding.id}`)}
            >
              <Card style={{ gap: sp['spacing-xs'] }}>
                <Text variant="heading-sm">{f.holding.name}</Text>
                <Text tone="textSecondary">
                  {f.units} · {t('investments.avgCost')}{' '}
                  {formatNaira(f.units > 0 ? f.cost / BigInt(Math.round(f.units)) : 0n)}
                </Text>
                {f.stalePrice ? (
                  <Text testID={`stale-price-${f.holding.id}`} tone="textSecondary">
                    {t('investments.priceNotUpdated')}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Amount minor={f.value} />
                  <GainCell f={f} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      {sheet === 'add' ? (
        <HoldingSheet
          onClose={closeSheet}
          onCreated={(h) => {
            setPendingTradeId(h.id);
            setSheet('buy');
          }}
        />
      ) : null}
      {sheet === 'buy' ? (
        <TradeSheet direction="buy" holdingId={pendingTradeId ?? paramHolding} onClose={closeSheet} />
      ) : null}
      {sheet === 'sell' ? <TradeSheet direction="sell" holdingId={paramHolding} onClose={closeSheet} /> : null}
      {sheet === 'dividend' ? <DividendSheet holdingId={dividendHoldingId} onClose={closeSheet} /> : null}
      {sheet === 'prices' ? <UpdatePricesSheet onClose={closeSheet} /> : null}
    </AppFrame>
  );
}
