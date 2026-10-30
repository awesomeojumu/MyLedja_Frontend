import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { RangePreset } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignAmount,
  RedesignButton,
  RedesignChip,
  RedesignEmpty,
  RedesignProgress,
  RedesignSkeleton,
  RedesignStackFrame,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { rangeFor } from '@/features/reports/runner';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';

import { cashFlowPage, drillHref, percentText, type FlowGroup } from './helpers';

const sp = tokens.space;
const shape = tokens.shape;

/** Figma Phone / Cash flow chips (5:2542): This month · Last month · 3 months · This year. */
const RANGE_CHIPS: {
  key: RangePreset;
  labelKey: 'reports.redesign.chipThisMonth' | 'reports.redesign.chipLastMonth' | 'reports.redesign.chip3Months' | 'reports.redesign.chipThisYear';
}[] = [
  { key: 'this_month', labelKey: 'reports.redesign.chipThisMonth' },
  { key: 'last_month', labelKey: 'reports.redesign.chipLastMonth' },
  { key: 'last_3_months', labelKey: 'reports.redesign.chip3Months' },
  { key: 'this_year', labelKey: 'reports.redesign.chipThisYear' },
];

function monthLong(monthKey: string): string {
  const m = Number(monthKey.slice(5, 7));
  return t(`date.monthLong.${m}` as TextKey);
}

function sharePct(amount: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Math.round(Number((amount * 1000n) / total) / 10);
}

function changeBp(now: bigint, before: bigint): bigint | null {
  if (before === 0n) return null;
  return ((now - before) * 10_000n) / (before < 0n ? -before : before);
}

function safeNum(v: bigint): number {
  return Number(v > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : v);
}

/**
 * Figma Mobile App Phone / Cash flow (5:2532).
 * Behind EXPO_PUBLIC_REDESIGN; W0 tokens/components only.
 */
export function RedesignCashFlowScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const params = useGlobalSearchParams<{ range?: string; view?: string }>();
  const onDate = today();

  const preset = (RANGE_CHIPS.some((c) => c.key === params.range) ? params.range : 'this_month') as RangePreset;
  const tableView = params.view === 'table';
  const bounds = rangeFor(preset, onDate, null);

  const privacy = false;

  const data = useMemo(
    () => (snapshot ? cashFlowPage(snapshot, { ...bounds, includeTransfers: false }) : null),
    [snapshot, bounds],
  );

  const setPreset = (key: RangePreset) => router.setParams({ range: key });
  const toggleTable = () => router.setParams({ view: tableView ? undefined : 'table' });

  const show = (v: bigint, signed = false) => {
    if (privacy) return PRIVACY_MASK;
    return formatNaira(v, signed ? { signed: true } : undefined);
  };

  const frame = (body: React.ReactNode) => (
    <RedesignStackFrame testID="redesign-cashflow" title={t('cashFlow.title')} onBack={() => router.back()}>
      {body}
    </RedesignStackFrame>
  );

  if (!snapshot || !data) {
    return frame(
      <View testID="redesign-cashflow-loading" style={{ gap: sp.lg }}>
        <RedesignSkeleton height={36} />
        <RedesignSkeleton height={140} />
        <RedesignSkeleton height={200} />
      </View>,
    );
  }

  const sources = data.bands.filter((b) => b.side === 'in');
  const sinks = data.groups.filter((g) => g.kind !== 'left_over');
  const leftBand = data.bands.find((b) => b.kind === 'left_over');
  const left = leftBand?.amount ?? data.tiles.in - data.tiles.out;
  const inTotal = data.tiles.in;
  const outTotal = data.tiles.out;
  const monthKey = bounds.to.slice(0, 7);
  const singleMonth = preset === 'this_month' || preset === 'last_month';
  const netTitle = singleMonth
    ? t('cashFlow.redesign.leftOverIn', { month: monthLong(monthKey) })
    : t('cashFlow.redesign.leftOver');
  const maxIn = sources.reduce((m, b) => (b.amount > m ? b.amount : m), 0n);
  const maxOut = sinks.reduce((m, g) => (g.amount > m ? g.amount : m), 0n);

  const see = (categoryId?: string) =>
    router.push(drillHref({ ...bounds, ...(categoryId ? { categoryId } : {}) }));

  if (data.bands.length === 0) {
    return frame(
      <View testID="redesign-cashflow-empty" style={{ gap: sp.lg }}>
        <ChipRow preset={preset} onSelect={setPreset} />
        <RedesignEmpty
          title={t('cashFlow.emptyTitle')}
          body={t('cashFlow.emptyBody')}
          actionLabel={t('cashFlow.addTransaction')}
          onAction={() => router.push('/transactions')}
        />
      </View>,
    );
  }

  return frame(
    <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
      <ChipRow preset={preset} onSelect={setPreset} />

      <View
        testID="redesign-cashflow-net"
        style={{
          backgroundColor: theme.surface,
          borderRadius: shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: sp.lg,
          gap: sp.sm,
        }}
      >
        <RedesignText variant="label" tone="textSecondary">
          {netTitle}
        </RedesignText>
        <RedesignAmount
          testID="redesign-cashflow-left"
          text={formatNaira(left < 0n ? -left : left)}
          hidden={privacy}
          sign={left < 0n ? '−' : '+'}
          sizeVariant="display"
        />
        <RedesignText tone="textSecondary">{t('cashFlow.redesign.moneyInMinusOut')}</RedesignText>
        <View
          testID="redesign-cashflow-in"
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}
        >
          <RedesignText>{t('cashFlow.redesign.moneyIn')}</RedesignText>
          <RedesignText style={{ fontVariant: ['tabular-nums'] }}>{show(inTotal, true)}</RedesignText>
        </View>
        <View
          testID="redesign-cashflow-out"
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}
        >
          <RedesignText>{t('cashFlow.redesign.moneyOut')}</RedesignText>
          <RedesignText style={{ fontVariant: ['tabular-nums'] }}>
            {privacy ? PRIVACY_MASK : `−${formatNaira(outTotal)}`}
          </RedesignText>
        </View>
      </View>

      {tableView ? (
        <TableCard groups={sinks} show={show} onCategory={see} />
      ) : (
        <>
          <BarSection
            testID="redesign-cashflow-from"
            title={t('cashFlow.redesign.whereItCameFrom')}
            items={sources.map((b) => ({
              key: b.key,
              label: b.label,
              amount: b.amount,
              pct: sharePct(b.amount, inTotal),
              categoryId: b.categoryId ?? undefined,
            }))}
            max={maxIn}
            show={show}
            onPress={see}
          />
          <BarSection
            testID="redesign-cashflow-went"
            title={t('cashFlow.whereItWent')}
            items={sinks.map((g) => ({
              key: g.key,
              label: g.label,
              amount: g.amount,
              pct: sharePct(g.amount, outTotal),
              categoryId: g.categories[0]?.categoryId,
            }))}
            max={maxOut}
            show={show}
            onPress={see}
          />
        </>
      )}

      <RedesignButton
        testID="redesign-cashflow-view-table"
        kind="link"
        label={tableView ? t('cashFlow.redesign.viewAsBars') : t('cashFlow.redesign.viewAsTable')}
        onPress={toggleTable}
      />
    </ScrollView>,
  );
}

function ChipRow({ preset, onSelect }: { preset: RangePreset; onSelect: (key: RangePreset) => void }) {
  return (
    <View testID="redesign-cashflow-chips" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
      {RANGE_CHIPS.map((chip) => (
        <RedesignChip
          key={chip.key}
          testID={`redesign-cashflow-range-${chip.key}`}
          label={t(chip.labelKey)}
          selected={preset === chip.key}
          onPress={() => onSelect(chip.key)}
        />
      ))}
    </View>
  );
}

function BarSection({
  testID,
  title,
  items,
  max,
  show,
  onPress,
}: {
  testID: string;
  title: string;
  items: { key: string; label: string; amount: bigint; pct: number; categoryId?: string }[];
  max: bigint;
  show: (v: bigint) => string;
  onPress: (categoryId?: string) => void;
}) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        padding: sp.lg,
        gap: sp.md,
      }}
    >
      <RedesignText variant="label" tone="textSecondary">
        {title}
      </RedesignText>
      {items.map((item) => (
        <Pressable
          key={item.key}
          testID={`${testID}-row-${item.key}`}
          accessibilityRole="button"
          accessibilityLabel={`${item.label}, ${item.pct}%, ${show(item.amount)}`}
          onPress={() => onPress(item.categoryId)}
          style={{ gap: sp.xs }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
            <RedesignText style={{ flex: 1 }} numberOfLines={1}>
              {item.label}
            </RedesignText>
            <RedesignText variant="helper" tone="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
              {`${item.pct}%`}
            </RedesignText>
            <RedesignText style={{ fontVariant: ['tabular-nums'], minWidth: 96, textAlign: 'right' }}>
              {show(item.amount)}
            </RedesignText>
          </View>
          <RedesignProgress
            testID={`${testID}-bar-${item.key}`}
            value={safeNum(item.amount)}
            max={safeNum(max) || 1}
          />
        </Pressable>
      ))}
    </View>
  );
}

function TableCard({
  groups,
  show,
  onCategory,
}: {
  groups: FlowGroup[];
  show: (v: bigint) => string;
  onCategory: (categoryId?: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const share = (bp: bigint | null) => (bp === null ? t('cashFlow.noIncome') : percentText(bp).replace('+', '').replace('−', ''));

  return (
    <View
      testID="redesign-cashflow-table"
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: sp.sm,
          paddingHorizontal: sp.md,
          paddingVertical: sp.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <RedesignText variant="caption" tone="textSecondary" style={{ flex: 2 }}>
          {t('cashFlow.col.group')}
        </RedesignText>
        <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
          {t('cashFlow.col.amount')}
        </RedesignText>
        <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
          {t('cashFlow.col.share')}
        </RedesignText>
        <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
          {t('cashFlow.col.change')}
        </RedesignText>
      </View>
      {groups.map((g) => {
        const change = changeBp(g.amount, g.previous);
        const can = g.categories.length > 0;
        const expanded = open.has(g.key);
        return (
          <View key={g.key}>
            <Pressable
              testID={`redesign-cashflow-group-${g.key}`}
              accessibilityRole={can ? 'button' : undefined}
              accessibilityState={can ? { expanded } : undefined}
              disabled={!can}
              onPress={() => toggle(g.key)}
              style={{
                flexDirection: 'row',
                gap: sp.sm,
                paddingHorizontal: sp.md,
                paddingVertical: sp.sm,
                minHeight: 48,
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <RedesignText style={{ flex: 2 }} numberOfLines={1}>
                {g.label}
              </RedesignText>
              <RedesignText style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                {show(g.amount)}
              </RedesignText>
              <RedesignText style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                {share(g.shareBasisPoints)}
              </RedesignText>
              <RedesignText
                testID={`redesign-cashflow-change-${g.key}`}
                style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}
              >
                {change === null ? t('cashFlow.new') : percentText(change)}
              </RedesignText>
            </Pressable>
            {expanded
              ? g.categories.map((cat) => (
                  <Pressable
                    key={cat.categoryId}
                    testID={`redesign-cashflow-cat-${cat.categoryId}`}
                    accessibilityRole="button"
                    onPress={() => onCategory(cat.categoryId)}
                    style={{
                      flexDirection: 'row',
                      gap: sp.sm,
                      paddingHorizontal: sp.md,
                      paddingLeft: sp.xl,
                      paddingVertical: sp.sm,
                      minHeight: 44,
                      alignItems: 'center',
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <RedesignText style={{ flex: 2 }} numberOfLines={1}>
                      {cat.label}
                    </RedesignText>
                    <RedesignText style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                      {show(cat.amount)}
                    </RedesignText>
                    <View style={{ flex: 2 }} />
                  </Pressable>
                ))
              : null}
          </View>
        );
      })}
    </View>
  );
}
