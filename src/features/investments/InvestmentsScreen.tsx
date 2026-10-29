import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

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
  formatDay,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import type { Holding } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatUnits } from '@/ledger';
import { formatMoney, PRIVACY_MASK } from '@/money';

import {
  averageCost,
  firstInvestmentDate,
  gainBasisPoints,
  isDown,
  portfolio,
  priceStatus,
  RANGES,
  type HoldingRow,
  type Range,
} from './helpers';
import { HoldingSheet, holdingTypeLabel, UpdatePricesSheet } from './investmentSheets';

const sp = tokens.spacing;
const c = tokens.color;

/** "+12.4%" or "−5.2%", from basis points. */
export function percentText(bp: bigint | null): string {
  if (bp === null) return '';
  const sign = bp > 0n ? '+' : bp < 0n ? '−' : '';
  const abs = bp < 0n ? -bp : bp;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0').slice(0, 1)}%`;
}

/** "Price not updated since 3 Oct 2026" when there's no recent price; the value then uses the cost (P17-06). */
export function staleNote(snapshotPrices: Parameters<typeof priceStatus>[0], row: HoldingRow, onDate: string, firstDate: string | null): string | null {
  const last = priceStatus(snapshotPrices, row.holding.id, onDate);
  if (row.position.units === 0n) return null;
  if (!last) return firstDate ? t('investments.priceStale', { date: formatDay(firstDate) }) : null;
  const age = (Date.parse(`${onDate}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000;
  return age > 30 ? t('investments.priceStale', { date: formatDay(last.date) }) : null;
}

type SortKey = 'name' | 'value' | 'gain';

export function InvestmentsScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const size = useSizeClass();
  const theme = useTheme();
  const { privacy } = useDesign();
  const [range, setRange] = useState<Range>('1Y');
  const [split, setSplit] = useState<'type' | 'account'>('type');
  const [adding, setAdding] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [sort, setSort] = useState<SortKey>('value');
  const onDate = today();

  const data = useMemo(() => (snapshot ? portfolio(snapshot, range, onDate) : null), [snapshot, range, onDate]);
  const rows = useMemo(() => {
    if (!data) return [];
    const by: Record<SortKey, (a: HoldingRow, b: HoldingRow) => number> = {
      name: (a, b) => a.holding.name.localeCompare(b.holding.name),
      value: (a, b) => (b.position.value > a.position.value ? 1 : b.position.value < a.position.value ? -1 : 0),
      gain: (a, b) => (b.position.unrealised > a.position.unrealised ? 1 : b.position.unrealised < a.position.unrealised ? -1 : 0),
    };
    return [...data.rows].sort(by[sort]);
  }, [data, sort]);
  const accountName = (id: string) => snapshot?.accounts.find((a) => a.id === id)?.name ?? '';
  const holdings = rows.map((r) => r.holding);
  const show = (minor: bigint, currency?: string) => (privacy ? PRIVACY_MASK : formatMoney(minor, currency));
  const phone = size === 'phone';
  const compactTable = size === 'tablet';

  const header = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center', marginBottom: sp['spacing-md'] }}>
      <SegmentedControl
        testID="investments-range"
        label={t('investments.range')}
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r, label: t(`investments.range.${r}`) }))}
      />
      <View style={{ flex: 1 }} />
      {holdings.length ? (
        <Button testID="investments-update-prices" kind="secondary" label={t('investments.updatePrices')} onPress={() => setPricing(true)} />
      ) : null}
      {/* While empty, the empty state's button is the one way to start (E-08). */}
      {holdings.length ? <Button testID="investments-add" label={t('investments.addHolding')} onPress={() => setAdding(true)} /> : null}
    </View>
  );

  const open = (h: Holding) => router.push(`/investments/${h.id}`);

  const body = !snapshot || !data ? (
    <View style={{ gap: sp['spacing-md'] }} testID="investments-loading">
      <Placeholder height={140} />
      <Placeholder height={200} />
    </View>
  ) : data.rows.length === 0 ? (
    <EmptyState
      testID="investments-empty"
      title={t('investments.emptyTitle')}
      body={t('investments.emptyBody')}
      actionLabel={t('investments.addHolding')}
      onAction={() => setAdding(true)}
    />
  ) : (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
      <Card style={{ gap: sp['spacing-sm'] }} testID="portfolio-card">
        <Text variant="caption" tone="textSecondary">
          {t('investments.portfolio')}
        </Text>
        <Amount testID="portfolio-value" minor={data.value} variant="display-md" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-lg'] }}>
          <Figure label={t('investments.unrealised')} value={`${show(data.unrealised)} ${percentText(gainBasisPoints(data.unrealised, data.cost))}`} testID="portfolio-unrealised" />
          <Figure label={t('investments.realised')} value={show(data.realised)} testID="portfolio-realised" />
          <Figure label={t('investments.dividends')} value={show(data.dividends)} testID="portfolio-dividends" />
        </View>
        {data.partial.length ? (
          <Text variant="caption" tone="textSecondary" testID="portfolio-partial">
            {t('investments.partial', { currencies: data.partial.join(', ') })}
          </Text>
        ) : null}
        <LineChart
          testID="portfolio-line"
          title={valueFinding(data.series)}
          columns={[t('investments.date'), t('investments.value')]}
          rows={data.series.map((p) => ({ label: formatDay(p.date), value: p.value }))}
        />
      </Card>

      <Card style={{ gap: sp['spacing-sm'] }}>
        {phone ? (
          <SegmentedControl
            testID="investments-split"
            label={t('investments.splitBy')}
            value={split}
            onChange={setSplit}
            options={[
              { value: 'type', label: t('investments.byType') },
              { value: 'account', label: t('investments.byAccount') },
            ]}
          />
        ) : null}
        <View style={{ flexDirection: phone ? 'column' : 'row', gap: sp['spacing-lg'] }}>
          {!phone || split === 'type' ? (
            <View style={{ flex: 1 }}>
              <DonutChart
                testID="investments-by-type"
                title={t('investments.byTypeTitle')}
                columns={[t('investments.typeLabel'), t('investments.value')]}
                total={data.value}
                goldLast={false}
                rows={data.byType.map((x) => ({ label: holdingTypeLabel(x.type), value: x.value }))}
              />
            </View>
          ) : null}
          {!phone || split === 'account' ? (
            <View style={{ flex: 1, gap: sp['spacing-xs'] }} testID="investments-by-account">
              <Text variant="heading-sm">{t('investments.byAccountTitle')}</Text>
              {data.byAccount.map((x) => (
                <View key={x.accountId} accessible style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text>{accountName(x.accountId)}</Text>
                  <Amount minor={x.value} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      {phone ? (
        <View style={{ gap: sp['spacing-sm'] }} testID="holdings-cards">
          {rows.map((row) => (
            <Pressable key={row.holding.id} accessibilityRole="button" testID={`holding-row-${row.holding.id}`} onPress={() => open(row.holding)}>
              <Card style={{ gap: sp['spacing-xs'] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="heading-sm">{row.holding.name}</Text>
                  <Amount minor={row.position.value} currency={row.holding.currency} />
                </View>
                <GainLine row={row} show={show} />
                <StaleLine snapshot={snapshot} row={row} onDate={onDate} />
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <Card style={{ gap: sp['spacing-xs'] }} testID="holdings-table">
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
            <SortHead label={t('investments.col.holding')} active={sort === 'name'} onPress={() => setSort('name')} flex={2} />
            <Head label={t('investments.col.account')} flex={1.5} />
            <Head label={t('investments.col.units')} />
            {compactTable ? null : <Head label={t('investments.col.avgCost')} />}
            {compactTable ? null : <Head label={t('investments.col.price')} />}
            <SortHead label={t('investments.col.value')} active={sort === 'value'} onPress={() => setSort('value')} />
            <SortHead label={t('investments.col.gain')} active={sort === 'gain'} onPress={() => setSort('gain')} />
          </View>
          {rows.map((row) => {
            const avg = averageCost(row.position);
            const price = row.position.price?.priceMinor ?? null;
            return (
              <Pressable
                key={row.holding.id}
                testID={`holding-row-${row.holding.id}`}
                accessibilityRole="button"
                accessibilityLabel={t('investments.rowLabel', {
                  name: row.holding.name,
                  value: show(row.position.value, row.holding.currency),
                  gain: show(row.position.unrealised, row.holding.currency),
                })}
                onPress={() => open(row.holding)}
                style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border }}
              >
                <View style={{ flex: 2 }}>
                  <Text>{row.holding.name}</Text>
                  <StaleLine snapshot={snapshot} row={row} onDate={onDate} />
                </View>
                <Text style={{ flex: 1.5 }}>{accountName(row.holding.accountId)}</Text>
                <Cell text={formatUnits(row.position.units)} />
                {compactTable ? null : <Cell text={avg === null ? '' : show(avg, row.holding.currency)} />}
                {compactTable ? null : <Cell text={price === null ? '' : show(price, row.holding.currency)} />}
                <Cell text={show(row.position.value, row.holding.currency)} />
                <View style={{ flex: 1 }}>
                  <GainLine row={row} show={show} />
                </View>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], borderTopWidth: 1, borderTopColor: theme.border, paddingTop: sp['spacing-xs'] }}>
            <Text variant="heading-sm" style={{ flex: 1 }}>
              {t('investments.total')}
            </Text>
            <Text testID="holdings-total" style={{ fontVariant: ['tabular-nums'] }}>
              {show(data.value)} {percentText(gainBasisPoints(data.unrealised, data.cost))}
            </Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );

  return (
    <AppFrame title={t('investments.title')}>
      {header}
      {body}
      {adding ? <HoldingSheet onClose={() => setAdding(false)} /> : null}
      {pricing ? <UpdatePricesSheet holdings={holdings} onClose={() => setPricing(false)} /> : null}
    </AppFrame>
  );
}

function StaleLine({ snapshot, row, onDate }: { snapshot: Snapshot; row: HoldingRow; onDate: string }) {
  const note = staleNote(snapshot, row, onDate, firstInvestmentDate(snapshot, row.holding.id));
  return note ? (
    <Text variant="caption" tone="textSecondary" testID={`stale-${row.holding.id}`}>
      {note}
    </Text>
  ) : null;
}

/** The value line's title says what it found (DESIGN.md 2.7). */
function valueFinding(series: { value: bigint }[]): string {
  const first = series[0]?.value ?? 0n;
  const last = series.at(-1)?.value ?? 0n;
  if (series.length < 2 || first === last) return t('investments.valueSteady');
  return last > first ? t('investments.valueRose') : t('investments.valueFell');
}

/** Gains and losses are ink with + and −; a loss over 10% gets a ruby dot and "Down" (DESIGN.md page 17). */
function GainLine({ row, show }: { row: HoldingRow; show: (v: bigint, currency?: string) => string }) {
  const down = isDown(row.position);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
      {down ? <View testID={`down-${row.holding.id}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.ruby }} /> : null}
      <Text style={{ fontVariant: ['tabular-nums'] }}>
        {down ? `${t('investments.down')} ` : ''}
        {percentText(gainBasisPoints(row.position.unrealised, row.position.cost)) || show(row.position.unrealised, row.holding.currency)}
      </Text>
    </View>
  );
}

function Figure({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Text testID={testID} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function Head({ label, flex = 1 }: { label: string; flex?: number }) {
  return (
    <Text variant="caption" tone="textSecondary" style={{ flex }}>
      {label}
    </Text>
  );
}

function SortHead({ label, active, onPress, flex = 1 }: { label: string; active: boolean; onPress: () => void; flex?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={t('investments.sortBy', { column: label })} onPress={onPress} style={{ flex }}>
      <Text variant="caption" tone={active ? 'link' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Cell({ text }: { text: string }) {
  return <Text style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{text}</Text>;
}
