import { useGlobalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { useState, type ReactElement } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  Confirm,
  EmptyState,
  formatDay,
  Icon,
  InlineError,
  LineChart,
  Menu,
  Placeholder,
  SegmentedControl,
  Text,
  useToast,
} from '@/design/components';
import { isRedesignEnabled } from '@/design/redesign';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTabParam } from '@/design/useTabParam';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { costOfPurchase } from '@/ledger';
import { formatNaira } from '@/money';

import { DividendSheet, HoldingSheet, TradeSheet, UpdatePricesSheet } from './investmentSheets';
import {
  RANGES,
  holdingFigures,
  holdingSeries,
  latestPrice,
  lotOpenCost,
  lotsFor,
  openUnits,
  pricesFor,
  type Range,
} from './helpers';
import { RedesignHoldingScreen } from './RedesignHoldingScreen';

const sp = tokens.spacing;
const TABS = ['lots', 'dividends', 'trades', 'prices'] as const;
type Tab = (typeof TABS)[number];

/** DESIGN.md page 18: one investment in depth — paid / worth / earned. */
export function HoldingScreen() {
  if (isRedesignEnabled()) return <RedesignHoldingScreen />;
  return <LegacyHoldingScreen />;
}

function LegacyHoldingScreen() {
  const { snapshot, repo } = useWorkspace();
  const params = useGlobalSearchParams<{ id?: string; tab?: string; trade?: string; dividend?: string; prices?: string; holding?: string }>();
  const router = useRouter();
  const toast = useToast();
  const theme = useTheme();
  const { user } = useAuth();
  const size = useSizeClass();
  const phone = size === 'phone';
  const landscape = size === 'tablet' || size === 'desktop' || size === 'wide';
  const [range, setRange] = useState<Range>('1Y');
  const { value: tab, setValue: setTab } = useTabParam<Tab>({
    pageKey: `holding:${params.id ?? 'none'}`,
    personId: user?.id,
    options: TABS,
    defaultValue: 'lots',
  });
  const deepSheet: 'edit' | 'buy' | 'sell' | 'dividend' | 'prices' | null =
    params.trade === 'buy' || params.trade === 'sell'
      ? params.trade
      : params.dividend
        ? 'dividend'
        : params.prices === '1'
          ? 'prices'
          : params.holding === 'edit'
            ? 'edit'
            : null;
  const [sheet, setSheet] = useState<'edit' | 'buy' | 'sell' | 'dividend' | 'prices' | null>(deepSheet);
  const [dismissedDeep, setDismissedDeep] = useState(false);
  const openSheet = sheet ?? (dismissedDeep ? null : deepSheet);
  const closeSheet = () => {
    setSheet(null);
    setDismissedDeep(true);
    router.setParams({ trade: undefined, dividend: undefined, prices: undefined, holding: undefined });
  };
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDate = today();

  const holding = snapshot?.holdings.find((h) => h.id === params.id);
  const account = snapshot && holding ? snapshot.accounts.find((a) => a.id === holding.accountId) : undefined;
  const figures = snapshot && holding ? holdingFigures(snapshot, holding) : null;
  const series = snapshot && holding ? holdingSeries(snapshot, holding, range, onDate) : [];
  const lots = snapshot && holding ? lotsFor(snapshot, holding.id) : [];
  const prices = snapshot && holding ? pricesFor(snapshot, holding.id) : [];

  const trades =
    !snapshot || !holding
      ? []
      : snapshot.events
          .filter(
            (e) =>
              (e.type === 'investment_buy' || e.type === 'investment_sell') &&
              e.status === 'posted' &&
              (e.holdingId === holding.id || e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId)),
          )
          .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const dividends =
    !snapshot || !holding
      ? []
      : snapshot.events
          .filter(
            (e) =>
              e.type === 'income' &&
              e.status === 'posted' &&
              (e.holdingId === holding.id ||
                e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId)),
          )
          .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const year = onDate.slice(0, 4);
  const dividendsThisYear = dividends
    .filter((e) => e.date.startsWith(year))
    .reduce((s, e) => s + e.lines.filter((l) => l.amountMinor > 0n).reduce((a, l) => a + l.amountMinor, 0n), 0n);

  if (snapshot && !holding) {
    return (
      <AppFrame title={t('investments.title')}>
        <EmptyState
          title={t('investments.missingTitle')}
          body={t('investments.missingBody')}
          actionLabel={t('investments.back')}
          onAction={() => router.push('/investments')}
        />
      </AppFrame>
    );
  }

  const openTx = (txId: string) => router.push({ pathname: '/transactions', params: { tx: txId } });
  const accountName = (id: string | null | undefined) => snapshot?.accounts.find((a) => a.id === id)?.name ?? '';

  const menu = [
    { key: 'edit', label: t('common.edit'), onPress: () => setSheet('edit') },
    { key: 'price', label: t('investments.updatePrice'), onPress: () => setSheet('prices') },
    { key: 'delete', label: t('investments.remove'), onPress: () => setRemoving(true) },
  ];

  const lotsSection = (
    <View testID="holding-lots" style={{ gap: sp['spacing-xs'] }}>
      <Text variant="heading-sm">{t('investments.lots')}</Text>
      {lots.length === 0 ? <Text tone="textSecondary">{t('investments.noLots')}</Text> : null}
      {lots.map((lot) => {
        const open = openUnits(lot);
        const sold = open <= 0;
        const openCost = lotOpenCost(lot);
        const price = figures?.price;
        const valueNow = !sold && price !== null && price !== undefined ? costOfPurchase(String(open), price, 0n) : null;
        const gain = valueNow !== null ? valueNow - openCost : null;
        const realised = BigInt(lot.realisedMinor ?? '0');
        return (
          <View
            key={lot.id}
            testID={`lot-${lot.id}`}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: sp['spacing-sm'],
              paddingVertical: sp['spacing-xs'],
              borderTopWidth: 1,
              borderTopColor: theme.border,
              opacity: sold ? 0.55 : 1,
            }}
          >
            <Text style={{ flex: 1 }}>{formatDay(lot.date)}</Text>
            <Text style={{ flex: 1 }}>
              {sold ? t('investments.sold') : `${open}`} · @ {formatNaira(BigInt(lot.pricePerUnitMinor))}
            </Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{formatNaira(openCost || BigInt(lot.costMinor))}</Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{sold ? '' : valueNow !== null ? formatNaira(valueNow) : '—'}</Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }} testID={`lot-gain-${lot.id}`}>
              {sold
                ? t('investments.realisedGain', { amount: formatNaira(realised) })
                : gain !== null
                  ? formatNaira(gain)
                  : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const dividendsSection = (
    <View testID="holding-dividends" style={{ gap: sp['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="heading-sm">{t('investments.dividends')}</Text>
        <Text tone="textSecondary">{t('investments.thisYear', { amount: formatNaira(dividendsThisYear) })}</Text>
      </View>
      {dividends.length === 0 ? <Text tone="textSecondary">{t('investments.noDividends')}</Text> : null}
      {dividends.map((e) => {
        const amount = e.lines.filter((l) => l.amountMinor > 0n).reduce((s, l) => s + l.amountMinor, 0n);
        const reinvested = holding ? e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId && l.amountMinor > 0n) : false;
        const cashId = e.lines.find((l) => l.amountMinor > 0n && (!holding || l.ledgerAccountId !== holding.ledgerAccountId))?.ledgerAccountId;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => openTx(e.id)}
            style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border }}
          >
            <Text style={{ flex: 1 }}>{formatDay(e.date)}</Text>
            <Text style={{ flex: 1 }}>{reinvested ? t('investments.reinvested') : accountName(cashId)}</Text>
            <Text style={{ fontVariant: ['tabular-nums'] }}>{formatNaira(amount)}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const tradesSection = (
    <View testID="holding-trades" style={{ gap: sp['spacing-xs'] }}>
      <Text variant="heading-sm">{t('investments.trades')}</Text>
      {trades.length === 0 ? <Text tone="textSecondary">{t('investments.noTrades')}</Text> : null}
      {trades.map((e) => {
        const buy = e.type === 'investment_buy';
        const amount = buy
          ? e.lines.find((l) => holding && l.ledgerAccountId === holding.ledgerAccountId)?.amountMinor ?? 0n
          : e.lines.find((l) => l.amountMinor > 0n && (!holding || l.ledgerAccountId !== holding.ledgerAccountId))?.amountMinor ?? 0n;
        return (
          <Pressable
            key={e.id}
            testID={`trade-${e.id}`}
            accessibilityRole="button"
            onPress={() => openTx(e.id)}
            style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border }}
          >
            <Text style={{ flex: 1 }}>{formatDay(e.date)}</Text>
            <Text style={{ flex: 1 }}>{buy ? t('investments.buy') : t('investments.sell')}</Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{formatNaira(amount)}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const pricesSection = (
    <View testID="holding-prices" style={{ gap: sp['spacing-xs'] }}>
      <Text variant="heading-sm">{t('investments.priceHistory')}</Text>
      {prices.length === 0 ? <Text tone="textSecondary">{t('investments.noPrices')}</Text> : null}
      {prices.map((p) => (
        <View
          key={p.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], borderTopWidth: 1, borderTopColor: theme.border, paddingVertical: sp['spacing-xs'] }}
        >
          <Text style={{ flex: 1 }}>{formatDay(p.date)}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{formatNaira(BigInt(p.priceMinor))}</Text>
          <Button
            kind="link"
            testID={`price-remove-${p.id}`}
            label={t('investments.removePrice')}
            onPress={() => void repo.deletePrice(p).then(() => toast.show(t('investments.priceRemoved')))}
          />
        </View>
      ))}
    </View>
  );

  const sections: Record<Tab, ReactElement> = {
    lots: lotsSection,
    dividends: dividendsSection,
    trades: tradesSection,
    prices: pricesSection,
  };

  const chart = figures ? (
    <Card style={{ gap: sp['spacing-sm'] }} testID="holding-performance">
      <SegmentedControl
        testID="holding-range"
        label={t('investments.range')}
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r, label: t(`investments.range.${r}` as 'investments.range.1M') }))}
      />
      <LineChart
        testID="holding-chart"
        title={t('investments.performanceTitle')}
        columns={[t('investments.date'), t('investments.value')]}
        rows={series.map((p) => ({ label: formatDay(p.date), value: p.value }))}
        compare={series.map((p) => p.cost)}
      />
      <Text variant="caption" tone="textSecondary">
        {t('investments.costDashed')}
      </Text>
    </Card>
  ) : null;

  return (
    <AppFrame title={holding?.name ?? t('investments.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }} testID="holding-screen">
        <Button kind="link" label={t('investments.back')} onPress={() => router.push('/investments')} style={{ alignSelf: 'flex-start' }} />
        {!holding || !figures || !snapshot ? (
          <Placeholder height={120} testID="holding-loading" />
        ) : (
          <>
            <View style={{ gap: sp['spacing-xs'] }}>
              <Text variant="caption" tone="textSecondary" testID="holding-subtitle">
                {[holding.name, holding.symbol, account?.name].filter(Boolean).join(' · ')}
              </Text>
              <Amount testID="holding-value" minor={figures.value} variant="display-md" />
              <Text testID="holding-gain" style={{ fontVariant: ['tabular-nums'] }}>
                {formatNaira(figures.gain)}
                {figures.gainPct !== null ? ` (${figures.gainPct.toFixed(1)}%)` : ''}
              </Text>
              <Text tone="textSecondary" testID="holding-units">
                {figures.price === null
                  ? t('investments.unitsAtCost', { units: String(figures.units) })
                  : t('investments.unitsAt', { units: String(figures.units), price: formatNaira(figures.price) })}
              </Text>
              {figures.price === null && figures.priceDate === null && figures.units > 0 ? (
                <Text tone="textSecondary" testID="holding-price-missing">
                  {t('investments.priceMissing')}
                </Text>
              ) : figures.priceDate && latestPrice(snapshot, holding.id)?.date !== onDate ? (
                <Text tone="textSecondary" testID="holding-price-stale">
                  {t('investments.priceStale', { date: formatDay(figures.priceDate) })}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
              <Button testID="holding-buy" label={t('investments.buy')} onPress={() => setSheet('buy')} />
              <Button
                testID="holding-sell"
                kind="secondary"
                label={t('investments.sell')}
                disabled={figures.units <= 0}
                onPress={() => setSheet('sell')}
              />
              <Button testID="holding-dividend" kind="secondary" label={t('investments.dividend')} onPress={() => setSheet('dividend')} />
              <Menu
                testID="holding-menu"
                items={menu}
                trigger={(openMenu) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('investments.more')}
                    onPress={openMenu}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon icon={MoreHorizontal} />
                  </Pressable>
                )}
              />
            </View>
            {error ? <InlineError message={error} /> : null}

            {landscape && !phone ? (
              <View style={{ flexDirection: 'row', gap: sp['spacing-lg'], alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>{chart}</View>
                <View style={{ flex: 1 }}>{lotsSection}</View>
              </View>
            ) : (
              chart
            )}

            {phone ? (
              <>
                <SegmentedControl
                  testID="holding-tabs"
                  label={t('investments.views')}
                  value={tab}
                  onChange={setTab}
                  options={TABS.map((value) => ({ value, label: t(`investments.${value}`) }))}
                />
                <Card>{sections[tab]}</Card>
              </>
            ) : (
              (landscape ? (['dividends', 'trades', 'prices'] as const) : TABS).map((k) => <Card key={k}>{sections[k]}</Card>)
            )}
          </>
        )}
      </ScrollView>

      {openSheet === 'edit' && holding ? <HoldingSheet holding={holding} onClose={closeSheet} /> : null}
      {openSheet === 'buy' && holding ? <TradeSheet direction="buy" holdingId={holding.id} onClose={closeSheet} /> : null}
      {openSheet === 'sell' && holding ? <TradeSheet direction="sell" holdingId={holding.id} onClose={closeSheet} /> : null}
      {openSheet === 'dividend' && holding ? <DividendSheet holdingId={holding.id} onClose={closeSheet} /> : null}
      {openSheet === 'prices' && holding ? <UpdatePricesSheet holdingId={holding.id} onClose={closeSheet} /> : null}
      <Confirm
        visible={removing}
        title={t('investments.removeTitle')}
        body={t('investments.removeBody')}
        confirmLabel={t('investments.removeConfirm')}
        onCancel={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          if (!holding) return;
          void repo.archiveHolding(holding.id).then((r) => {
            if (!r.ok) {
              setError(r.error === 'not_positive' ? t('investments.removeHasUnits') : ledgerMessage(r.error));
              return;
            }
            toast.show(t('investments.removed'));
            router.push('/investments');
          });
        }}
      />
    </AppFrame>
  );
}
