import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { useMemo, useState, type ReactElement } from 'react';
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
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatUnits, roundUnitsCost, valueOf } from '@/ledger';
import { formatMoney, PRIVACY_MASK } from '@/money';

import { firstInvestmentDate, gainBasisPoints, holdingRows, RANGES, seriesDates, type Range } from './helpers';
import { percentText } from './InvestmentsScreen';
import { DividendSheet, HoldingSheet, TradeSheet, UpdatePricesSheet } from './investmentSheets';

const sp = tokens.spacing;

type Section = 'lots' | 'dividends' | 'trades' | 'prices';

/** DESIGN.md page 18: one investment in depth: what you paid, what it's worth, what it earned. */
export function HoldingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const theme = useTheme();
  const { privacy } = useDesign();
  const phone = useSizeClass() === 'phone';
  const [range, setRange] = useState<Range>('1Y');
  const [section, setSection] = useState<Section>('lots');
  const [sheet, setSheet] = useState<'buy' | 'sell' | 'dividend' | 'edit' | 'price' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDate = today();

  const holding = snapshot?.holdings.find((h) => h.id === id);
  const data = useMemo(() => {
    if (!snapshot || !holding) return null;
    const row = holdingRows(snapshot, onDate).find((r) => r.holding.id === holding.id)!;
    const first = firstInvestmentDate(snapshot, holding.id);
    const series = seriesDates(range, onDate, first).map((date) => {
      const at = holdingRows(snapshot, date).find((r) => r.holding.id === holding.id)!.position;
      return { date, value: at.value, cost: at.cost };
    });
    const events = snapshot.events.filter((e) => e.holdingId === holding.id && e.investment && e.status === 'posted');
    const trades = events
      .filter((e) => e.investment!.kind === 'buy' || e.investment!.kind === 'sell')
      .map((e) => {
        const m = e.investment!;
        const sale = m.kind === 'sell';
        const amount = sale
          ? (e.lines.find((l) => l.amountMinor > 0n && l.ledgerAccountId !== holding.id)?.amountMinor ?? 0n)
          : (e.lines.find((l) => l.ledgerAccountId === holding.id)?.amountMinor ?? 0n);
        const gain = m.kind === 'sell' ? amount - m.lots.reduce((s, l) => s + BigInt(l.cost), 0n) : null;
        return { id: e.id, date: e.date, kind: m.kind as 'buy' | 'sell', units: 'units' in m ? m.units : '', amount, gain };
      });
    const dividends = events
      .filter((e) => e.investment!.kind === 'dividend' || e.investment!.kind === 'reinvest')
      .map((e) => ({
        id: e.id,
        date: e.date,
        amount: -(e.lines.find((l) => l.amountMinor < 0n)?.amountMinor ?? 0n),
        accountId: e.investment!.kind === 'dividend' ? (e.lines.find((l) => l.amountMinor > 0n)?.ledgerAccountId ?? null) : null,
        reinvested: e.investment!.kind === 'reinvest',
      }));
    const year = onDate.slice(0, 4);
    const prices = snapshot.prices.filter((p) => p.holdingId === holding.id).sort((a, b) => b.date.localeCompare(a.date));
    return {
      row,
      series,
      trades: trades.sort((a, b) => b.date.localeCompare(a.date)),
      dividends: dividends.sort((a, b) => b.date.localeCompare(a.date)),
      dividendsThisYear: dividends.filter((d) => d.date.startsWith(year)).reduce((s, d) => s + d.amount, 0n),
      prices,
    };
  }, [snapshot, holding, range, onDate]);

  if (!snapshot) {
    return (
      <AppFrame title={t('investments.title')}>
        <Placeholder height={160} testID="holding-loading" />
      </AppFrame>
    );
  }
  if (!holding || !data) {
    return (
      <AppFrame title={t('investments.title')}>
        <EmptyState
          testID="holding-missing"
          title={t('investments.missingTitle')}
          body={t('investments.missingBody')}
          actionLabel={t('investments.backToInvestments')}
          onAction={() => router.push('/investments')}
        />
      </AppFrame>
    );
  }

  const { position } = data.row;
  const cur = holding.currency;
  const show = (v: bigint, signed = false) => (privacy ? PRIVACY_MASK : formatMoney(v, cur, { signed }));
  const account = snapshot.accounts.find((a) => a.id === holding.accountId);
  const price = position.price?.priceMinor ?? null;
  const accountName = (accId: string | null) => snapshot.accounts.find((a) => a.id === accId)?.name ?? '';
  const openTx = (txId: string) => router.push({ pathname: '/transactions', params: { tx: txId } });

  const menu = [
    { key: 'edit', label: t('investments.edit'), onPress: () => setSheet('edit') },
    { key: 'price', label: t('investments.updatePrice'), onPress: () => setSheet('price') },
    { key: 'delete', label: t('investments.remove'), onPress: () => setRemoving(true) },
  ];

  const lots = (
    <View style={{ gap: sp['spacing-xs'] }} testID="holding-lots">
      <Text variant="heading-sm">{t('investments.lots')}</Text>
      {data.row.lots.length === 0 ? <Text tone="textSecondary">{t('investments.noLots')}</Text> : null}
      {data.row.lots.map((l) => {
        const value = price === null ? l.cost : valueOf(l.units, price);
        const sold = l.units === 0n;
        return (
          <View
            key={l.lotId}
            testID={`lot-${l.lotId}`}
            accessible
            accessibilityLabel={t('investments.lotRow', {
              date: formatDay(l.date),
              units: formatUnits(l.boughtUnits),
              cost: show(l.boughtCost),
            })}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border, opacity: sold ? 0.5 : 1 }}
          >
            <Text style={{ flex: 1 }}>{formatDay(l.date)}</Text>
            <Text style={{ flex: 1 }}>{t('investments.unitsOf', { held: formatUnits(l.units), bought: formatUnits(l.boughtUnits) })}</Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{show(roundUnitsCost(l.boughtCost, l.boughtUnits || 1n))}</Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{show(l.cost)}</Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{sold ? '' : show(value)}</Text>
            <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }} testID={`lot-gain-${l.lotId}`}>
              {sold ? t('investments.realisedGain', { amount: show(l.realised, true) }) : show(value - l.cost, true)}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const dividends = (
    <View style={{ gap: sp['spacing-xs'] }} testID="holding-dividends">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="heading-sm">{t('investments.dividends')}</Text>
        <Text tone="textSecondary">{t('investments.thisYear', { amount: show(data.dividendsThisYear) })}</Text>
      </View>
      {data.dividends.length === 0 ? <Text tone="textSecondary">{t('investments.noDividends')}</Text> : null}
      {data.dividends.map((d) => (
        <Pressable key={d.id} accessibilityRole="button" onPress={() => openTx(d.id)} style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ flex: 1 }}>{formatDay(d.date)}</Text>
          <Text style={{ flex: 1 }}>{d.reinvested ? t('investments.reinvested') : accountName(d.accountId)}</Text>
          <Text style={{ fontVariant: ['tabular-nums'] }}>{show(d.amount)}</Text>
        </Pressable>
      ))}
    </View>
  );

  const trades = (
    <View style={{ gap: sp['spacing-xs'] }} testID="holding-trades">
      <Text variant="heading-sm">{t('investments.trades')}</Text>
      {data.trades.length === 0 ? <Text tone="textSecondary">{t('investments.noTrades')}</Text> : null}
      {data.trades.map((tr) => (
        <Pressable
          key={tr.id}
          testID={`trade-${tr.id}`}
          accessibilityRole="button"
          onPress={() => openTx(tr.id)}
          style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border }}
        >
          <Text style={{ flex: 1 }}>{formatDay(tr.date)}</Text>
          <Text style={{ flex: 1 }}>{tr.kind === 'buy' ? t('investments.boughtUnits', { units: tr.units }) : t('investments.soldUnits', { units: tr.units })}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{show(tr.amount)}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{tr.gain === null ? '' : show(tr.gain, true)}</Text>
        </Pressable>
      ))}
    </View>
  );

  const prices = (
    <View style={{ gap: sp['spacing-xs'] }} testID="holding-prices">
      <Text variant="heading-sm">{t('investments.priceHistory')}</Text>
      {data.prices.length === 0 ? <Text tone="textSecondary">{t('investments.noPrices')}</Text> : null}
      {data.prices.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ flex: 1 }}>{formatDay(p.date)}</Text>
          <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{show(BigInt(p.priceMinor))}</Text>
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

  const sections: Record<Section, ReactElement> = { lots, dividends, trades, prices };

  return (
    <AppFrame title={holding.name}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }} testID="holding-screen">
        <View style={{ gap: sp['spacing-xs'] }}>
          <Button kind="link" label={t('investments.backToInvestments')} onPress={() => router.push('/investments')} />
          <Text variant="caption" tone="textSecondary">
            {[holding.name, holding.symbol, account?.name].filter(Boolean).join(' · ')}
          </Text>
          <Amount testID="holding-value" minor={position.value} currency={cur} variant="display-md" />
          <Text testID="holding-gain" style={{ fontVariant: ['tabular-nums'] }}>
            {show(position.unrealised, true)} {percentText(gainBasisPoints(position.unrealised, position.cost))}
          </Text>
          <Text tone="textSecondary" testID="holding-units">
            {price === null
              ? t('investments.unitsAtCost', { units: formatUnits(position.units) })
              : t('investments.unitsAt', { units: formatUnits(position.units), price: show(price) })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
          <Button testID="holding-buy" label={t('investments.buy')} onPress={() => setSheet('buy')} />
          <Button testID="holding-sell" kind="secondary" label={t('investments.sell')} disabled={position.units === 0n} onPress={() => setSheet('sell')} />
          <Button testID="holding-dividend" kind="secondary" label={t('investments.dividend')} onPress={() => setSheet('dividend')} />
          <Menu
            testID="holding-menu"
            items={menu}
            trigger={(openMenu) => (
              <Pressable accessibilityRole="button" accessibilityLabel={t('investments.more')} onPress={openMenu} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={MoreHorizontal} />
              </Pressable>
            )}
          />
        </View>
        {error ? <InlineError message={error} /> : null}

        <Card style={{ gap: sp['spacing-sm'] }}>
          <SegmentedControl
            testID="holding-range"
            label={t('investments.range')}
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: t(`investments.range.${r}`) }))}
          />
          <LineChart
            testID="holding-chart"
            title={t('investments.performanceTitle')}
            columns={[t('investments.date'), t('investments.value')]}
            rows={data.series.map((p) => ({ label: formatDay(p.date), value: p.value }))}
            compare={data.series.map((p) => p.cost)}
          />
          <Text variant="caption" tone="textSecondary">
            {t('investments.costDashed')}
          </Text>
        </Card>

        {phone ? (
          <>
            <SegmentedControl
              testID="holding-sections"
              label={t('investments.sections')}
              value={section}
              onChange={setSection}
              options={[
                { value: 'lots', label: t('investments.lots') },
                { value: 'dividends', label: t('investments.dividends') },
                { value: 'trades', label: t('investments.trades') },
                { value: 'prices', label: t('investments.prices') },
              ]}
            />
            <Card>{sections[section]}</Card>
          </>
        ) : (
          (['lots', 'dividends', 'trades', 'prices'] as const).map((k) => <Card key={k}>{sections[k]}</Card>)
        )}
      </ScrollView>

      {sheet === 'buy' || sheet === 'sell' ? <TradeSheet holding={holding} mode={sheet} onClose={() => setSheet(null)} /> : null}
      {sheet === 'dividend' ? <DividendSheet holding={holding} onClose={() => setSheet(null)} /> : null}
      {sheet === 'edit' ? <HoldingSheet existing={holding} onClose={() => setSheet(null)} /> : null}
      {sheet === 'price' ? <UpdatePricesSheet holdings={[holding]} onClose={() => setSheet(null)} /> : null}
      <Confirm
        visible={removing}
        title={t('investments.removeTitle')}
        body={t('investments.removeBody')}
        confirmLabel={t('investments.removeConfirm')}
        onCancel={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          void repo.archiveHolding(holding.id).then((r) => {
            if (!r.ok) {
              setError(r.error === 'not_enough_units' ? t('investments.removeHasUnits') : ledgerMessage(r.error));
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
