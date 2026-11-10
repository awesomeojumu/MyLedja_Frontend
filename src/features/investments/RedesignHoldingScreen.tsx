import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useToast } from '@/design/components';
import { useDesign } from '@/design/ThemeProvider';
import {
  RedesignAmount,
  RedesignButton,
  RedesignChip,
  RedesignDialog,
  RedesignIcon,
  RedesignLineChart,
  RedesignListRow,
  RedesignSkeleton,
  RedesignStackFrame,
  RedesignText,
  isRedesignEnabled,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';

import {
  formatGain,
  holdingFigures,
  holdingSeries,
  lotOpenCost,
  lotsFor,
  openUnits,
  pricesFor,
  type Range,
} from './helpers';
import {
  RedesignAddCostSheet,
  RedesignAddMoneySheet,
  RedesignUpdateValueSheet,
  RedesignWriteOffSheet,
} from './redesignInvestmentSheets';

const sp = tokens.space;
const shape = tokens.shape;

function todayLagos() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

function formatMonthDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function typeLabel(type: string): string {
  return t(`investments.redesign.type.${type}` as 'investments.redesign.type.fund');
}

function formatUnits(units: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 }).format(units);
}

type HoldingTab = 'overview' | 'improvements' | 'lots' | 'dividends' | 'history';

/**
 * Figma Mobile App Phone / Holding (5:2062) + Update value (5:2131)
 * Upgraded with Land & Real Estate profiling, Capital Improvements,
 * Appraisals, Disaster / Write-Offs, and CAGR analytics.
 */
export function RedesignHoldingScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const { privacy } = useDesign();
  const toast = useToast();
  const params = useGlobalSearchParams<{ id?: string; sheet?: string; range?: string }>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(((params.range as Range) || '1Y') as Range);
  const [activeTab, setActiveTab] = useState<HoldingTab>('overview');

  const sheet =
    params.sheet === 'update' || params.sheet === 'add' || params.sheet === 'cost' || params.sheet === 'writeOff'
      ? params.sheet
      : null;
  const openSheet = (s: 'update' | 'add' | 'cost' | 'writeOff') => router.setParams({ sheet: s });
  const closeSheet = () => router.setParams({ sheet: undefined });

  const holding = snapshot?.holdings.find((h) => h.id === params.id);
  const account = snapshot && holding ? snapshot.accounts.find((a) => a.id === holding.accountId) : undefined;
  const onDate = todayLagos();
  const figures = snapshot && holding ? holdingFigures(snapshot, holding, onDate) : null;
  const series = snapshot && holding ? holdingSeries(snapshot, holding, range, onDate) : [];
  const prices = snapshot && holding ? pricesFor(snapshot, holding.id) : [];
  const lots = snapshot && holding ? lotsFor(snapshot, holding.id) : [];

  const isLandOrProperty = holding ? holding.type === 'land' || holding.type === 'realEstate' : false;

  type HistoryRow = { id: string; kind: 'value' | 'money' | 'improvement'; title: string; date: string; trailing: string; sort: string };
  const history: HistoryRow[] = [];
  const improvements: { id: string; title: string; date: string; amount: bigint }[] = [];

  if (snapshot && holding) {
    const units = figures?.units ?? 1;
    for (const p of prices) {
      const total =
        units === 1
          ? BigInt(p.priceMinor)
          : (BigInt(p.priceMinor) * BigInt(Math.round(units * 1e6))) / 1_000_000n;
      history.push({
        id: `price-${p.id}`,
        kind: 'value',
        title: t('investments.redesign.historyValueUpdated'),
        date: p.date,
        trailing: formatNaira(total),
        sort: `${p.date}-p-${p.id}`,
      });
    }

    for (const e of snapshot.events) {
      if (e.status !== 'posted') continue;
      if (e.type === 'investment_buy') {
        if (e.holdingId !== holding.id && !e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId)) continue;
        const amount =
          e.lines.find((l) => l.ledgerAccountId === holding.ledgerAccountId)?.amountMinor ??
          e.lines.find((l) => l.amountMinor < 0n)?.amountMinor ??
          0n;
        const abs = amount < 0n ? -amount : amount;

        // Check if capital improvement
        const eventTitle = e.notes || e.payeeName;
        const isImprovement = !!eventTitle && eventTitle !== 'Buy' && eventTitle !== 'Add investment';
        if (isImprovement) {
          improvements.push({
            id: e.id,
            title: eventTitle ?? t('investments.redesign.improvements'),
            date: e.date,
            amount: abs,
          });
        }

        history.push({
          id: `buy-${e.id}`,
          kind: isImprovement ? 'improvement' : 'money',
          title: isImprovement ? (eventTitle ?? t('investments.redesign.improvements')) : t('investments.redesign.historyAddedMoney'),
          date: e.date,
          trailing: `+${formatNaira(abs)}`,
          sort: `${e.date}-b-${e.id}`,
        });
      }
    }
    history.sort((a, b) => b.sort.localeCompare(a.sort));
    improvements.sort((a, b) => b.date.localeCompare(a.date));
  }

  // Dividends list for yield assets
  const dividends =
    !snapshot || !holding
      ? []
      : snapshot.events
          .filter(
            (e) =>
              e.type === 'income' &&
              e.status === 'posted' &&
              (e.holdingId === holding.id || e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId)),
          )
          .sort((a, b) => b.date.localeCompare(a.date));

  let gainCaption = '';
  if (figures) {
    const gain = formatGain(figures.gain, figures.gainPct);
    const updated = figures.priceDate
      ? t('investments.redesign.updatedOn', { date: formatMonthDay(figures.priceDate) })
      : lots[0]
        ? t('investments.redesign.updatedOn', { date: formatMonthDay(lots[0]!.date) })
        : '';
    gainCaption = updated ? `${gain}. ${updated}` : gain;
  }

  if (snapshot && !holding) {
    return (
      <RedesignStackFrame title={t('investments.title')} onBack={() => router.push('/investments')}>
        <View testID="redesign-holding-missing" style={{ gap: sp.lg, alignItems: 'center', padding: sp.xl }}>
          <RedesignText variant="headline">{t('investments.missingTitle')}</RedesignText>
          <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
            {t('investments.missingBody')}
          </RedesignText>
          <RedesignButton label={t('investments.back')} onPress={() => router.push('/investments')} />
        </View>
      </RedesignStackFrame>
    );
  }

  return (
    <RedesignStackFrame
      testID="redesign-holding"
      title={holding?.name ?? t('investments.title')}
      onBack={() => router.back()}
      trailing={
        <Pressable
          testID="redesign-holding-more"
          accessibilityRole="button"
          accessibilityLabel={t('investments.more')}
          onPress={() => setMenuOpen(true)}
          style={{
            width: tokens.density.touch.minTarget,
            height: tokens.density.touch.minTarget,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RedesignIcon name="more" size={24} color={theme.text} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.huge }} testID="redesign-holding-screen">
        {!holding || !figures ? (
          <RedesignSkeleton height={160} testID="redesign-holding-skeleton" />
        ) : (
          <>
            {/* Written Off Banner if applicable */}
            {holding.isWrittenOff ? (
              <View
                testID="redesign-holding-written-off-banner"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderRadius: shape['radius-md'],
                  borderWidth: 1,
                  borderColor: theme.danger,
                  padding: sp.md,
                  gap: sp.xs,
                }}
              >
                <RedesignText variant="label" style={{ color: theme.danger }}>
                  {t('investments.redesign.writtenOffBanner', {
                    date: holding.writeOffDate ? formatMonthDay(holding.writeOffDate) : '',
                    reason: holding.writeOffReason ?? '',
                    loss: formatNaira(BigInt(holding.writeOffAmountMinor || '0')),
                  })}
                </RedesignText>
                {holding.writeOffNotes ? (
                  <RedesignText variant="caption" tone="textSecondary">
                    {holding.writeOffNotes}
                  </RedesignText>
                ) : null}
              </View>
            ) : null}

            {/* Performance Card */}
            <View
              testID="redesign-holding-value"
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                padding: sp.lg,
                gap: sp.md,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <RedesignText variant="label" tone="textSecondary">
                  {t('investments.redesign.worthToday')}
                </RedesignText>
                {figures.cagr !== null ? (
                  <View
                    testID="redesign-holding-cagr"
                    style={{
                      paddingHorizontal: sp.sm,
                      paddingVertical: sp.xs,
                      borderRadius: shape['radius-sm'],
                      backgroundColor: theme.surfaceMuted,
                    }}
                  >
                    <RedesignText variant="caption">
                      {t('investments.redesign.cagr', { cagr: figures.cagr })}
                    </RedesignText>
                  </View>
                ) : null}
              </View>

              <RedesignAmount
                testID="redesign-holding-amount"
                text={formatNaira(figures.value)}
                hidden={privacy}
                sizeVariant="display"
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, alignItems: 'center' }}>
                <RedesignText testID="redesign-holding-gain" tone="textSecondary">
                  {privacy ? PRIVACY_MASK : gainCaption}
                </RedesignText>
                {figures.duration ? (
                  <RedesignText variant="caption" tone="textSecondary">
                    · {t('investments.redesign.duration', { duration: figures.duration })}
                  </RedesignText>
                ) : null}
              </View>

              {/* Time Range Chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
                {(['1M', '3M', '6M', '1Y', 'All'] as Range[]).map((key) => (
                  <RedesignChip
                    key={key}
                    testID={`redesign-holding-range-${key}`}
                    label={key === 'All' ? t('investments.rangeAll') : key}
                    selected={range === key}
                    onPress={() => setRange(key)}
                  />
                ))}
              </View>

              {series.length > 1 ? (
                <RedesignLineChart
                  testID="redesign-holding-chart"
                  points={series.map((p) => ({ value: p.value }))}
                />
              ) : null}
            </View>

            {/* Navigation Tabs */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
              <RedesignChip
                testID="redesign-tab-overview"
                label={t('investments.redesign.tabs.overview')}
                selected={activeTab === 'overview'}
                onPress={() => setActiveTab('overview')}
              />
              {isLandOrProperty ? (
                <RedesignChip
                  testID="redesign-tab-improvements"
                  label={`${t('investments.redesign.tabs.improvements')} (${improvements.length})`}
                  selected={activeTab === 'improvements'}
                  onPress={() => setActiveTab('improvements')}
                />
              ) : null}
              <RedesignChip
                testID="redesign-tab-lots"
                label={`${t('investments.redesign.tabs.lots')} (${lots.length})`}
                selected={activeTab === 'lots'}
                onPress={() => setActiveTab('lots')}
              />
              {dividends.length > 0 ? (
                <RedesignChip
                  testID="redesign-tab-dividends"
                  label={`${t('investments.redesign.tabs.dividends')} (${dividends.length})`}
                  selected={activeTab === 'dividends'}
                  onPress={() => setActiveTab('dividends')}
                />
              ) : null}
              <RedesignChip
                testID="redesign-tab-history"
                label={`${t('investments.redesign.tabs.history')} (${history.length})`}
                selected={activeTab === 'history'}
                onPress={() => setActiveTab('history')}
              />
            </View>

            {/* Overview Tab Content */}
            {activeTab === 'overview' ? (
              <View
                testID="redesign-holding-details"
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: shape['radius-lg'],
                  borderWidth: 1,
                  borderColor: theme.border,
                  paddingHorizontal: sp.lg,
                  paddingVertical: sp.sm,
                }}
              >
                <DetailRow label={t('investments.type')} value={typeLabel(holding.type)} />
                {holding.location ? (
                  <DetailRow label={t('investments.redesign.location')} value={holding.location} />
                ) : null}
                {holding.titleStatus ? (
                  <DetailRow label={t('investments.redesign.titleStatus')} value={holding.titleStatus} />
                ) : null}
                <DetailRow
                  label={t('investments.redesign.youPutIn')}
                  value={privacy ? PRIVACY_MASK : formatNaira(figures.cost)}
                />
                <DetailRow
                  label={t('investments.units')}
                  value={
                    holding.unitType && holding.unitType !== 'units'
                      ? `${formatUnits(figures.units)} ${t(`investments.redesign.unit.${holding.unitType}` as 'investments.redesign.unit.plots')}`
                      : formatUnits(figures.units)
                  }
                />
                <DetailRow
                  label={t('investments.redesign.countsInBudget')}
                  value={account?.countInBudget ? t('common.yes') : t('common.no')}
                  last
                />
              </View>
            ) : null}

            {/* Improvements Tab Content */}
            {activeTab === 'improvements' ? (
              <View
                testID="redesign-holding-improvements"
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
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: sp.md,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <RedesignText variant="label">{t('investments.redesign.improvementsTitle')}</RedesignText>
                  <RedesignButton
                    testID="redesign-improvements-add"
                    kind="link"
                    label={t('investments.redesign.addCostAction')}
                    onPress={() => openSheet('cost')}
                  />
                </View>
                {improvements.length === 0 ? (
                  <View style={{ padding: sp.lg }}>
                    <RedesignText tone="textSecondary">{t('investments.redesign.noImprovements')}</RedesignText>
                  </View>
                ) : (
                  improvements.map((item) => (
                    <RedesignListRow
                      key={item.id}
                      testID={`redesign-improvement-${item.id}`}
                      title={item.title}
                      subtitle={formatMonthDay(item.date)}
                      trailing={privacy ? PRIVACY_MASK : `+${formatNaira(item.amount)}`}
                    />
                  ))
                )}
              </View>
            ) : null}

            {/* Lots Tab Content */}
            {activeTab === 'lots' ? (
              <View
                testID="redesign-holding-lots-table"
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
                    paddingHorizontal: sp.md,
                    paddingVertical: sp.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                    gap: sp.sm,
                  }}
                >
                  <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1.2 }}>
                    Date
                  </RedesignText>
                  <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
                    Units
                  </RedesignText>
                  <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1.2, textAlign: 'right' }}>
                    Cost
                  </RedesignText>
                </View>
                {lots.map((lot) => {
                  const open = openUnits(lot);
                  const sold = open <= 0;
                  const openCost = lotOpenCost(lot);
                  return (
                    <View
                      key={lot.id}
                      testID={`redesign-lot-${lot.id}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: sp.md,
                        paddingVertical: sp.md,
                        borderTopWidth: 1,
                        borderTopColor: theme.border,
                        gap: sp.sm,
                        opacity: sold ? 0.5 : 1,
                      }}
                    >
                      <RedesignText style={{ flex: 1.2 }}>{formatMonthDay(lot.date)}</RedesignText>
                      <RedesignText style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                        {sold ? t('investments.sold') : lot.units}
                      </RedesignText>
                      <RedesignText style={{ flex: 1.2, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                        {privacy ? PRIVACY_MASK : formatNaira(openCost || BigInt(lot.costMinor))}
                      </RedesignText>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Dividends Tab Content */}
            {activeTab === 'dividends' ? (
              <View
                testID="redesign-holding-dividends-list"
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: shape['radius-lg'],
                  borderWidth: 1,
                  borderColor: theme.border,
                  overflow: 'hidden',
                }}
              >
                {dividends.map((e) => {
                  const gross = e.lines.find((l) => l.amountMinor > 0n)?.amountMinor ?? 0n;
                  return (
                    <RedesignListRow
                      key={e.id}
                      testID={`redesign-dividend-${e.id}`}
                      title={e.notes || e.payeeName || t('investments.dividend')}
                      subtitle={formatMonthDay(e.date)}
                      trailing={privacy ? PRIVACY_MASK : `+${formatNaira(gross)}`}
                    />
                  );
                })}
              </View>
            ) : null}

            {/* History Tab Content */}
            {activeTab === 'history' || activeTab === 'overview' ? (
              <>
                <RedesignText variant="label" tone="textSecondary">
                  {t('investments.redesign.history')}
                </RedesignText>
                <View
                  testID="redesign-holding-history"
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: shape['radius-lg'],
                    borderWidth: 1,
                    borderColor: theme.border,
                    overflow: 'hidden',
                  }}
                >
                  {history.length === 0 ? (
                    <View style={{ padding: sp.lg }}>
                      <RedesignText tone="textSecondary">{t('investments.redesign.noHistory')}</RedesignText>
                    </View>
                  ) : (
                    history.map((row) => (
                      <RedesignListRow
                        key={row.id}
                        testID={`redesign-history-${row.id}`}
                        title={row.title}
                        subtitle={formatMonthDay(row.date)}
                        trailing={privacy ? PRIVACY_MASK : row.trailing}
                      />
                    ))
                  )}
                </View>
              </>
            ) : null}

            {error ? (
              <RedesignText testID="redesign-holding-error" style={{ color: theme.danger }}>
                {error}
              </RedesignText>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Action Footer */}
      {holding && figures ? (
        <View
          testID="redesign-holding-footer"
          style={{
            flexDirection: 'column',
            gap: sp.sm,
            paddingTop: sp.md,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.page,
          }}
        >
          <RedesignButton
            testID="redesign-holding-update"
            label={t('investments.redesign.updateValue')}
            onPress={() => openSheet('update')}
            fullWidth
          />
          {isLandOrProperty ? (
            <RedesignButton
              testID="redesign-holding-add-cost"
              kind="secondary"
              label={t('investments.redesign.addCostTitle')}
              onPress={() => openSheet('cost')}
              fullWidth
            />
          ) : null}
          <RedesignButton
            testID="redesign-holding-add-money"
            kind="secondary"
            label={t('investments.redesign.addMoney')}
            onPress={() => openSheet('add')}
            fullWidth
          />
        </View>
      ) : null}

      {/* Sheets & Dialogs */}
      {sheet === 'update' && holding && figures ? (
        <RedesignUpdateValueSheet
          holdingId={holding.id}
          currentValue={figures.value}
          lastPriceDate={figures.priceDate}
          units={figures.units}
          onClose={closeSheet}
        />
      ) : null}

      {sheet === 'add' && holding ? (
        <RedesignAddMoneySheet holdingId={holding.id} onClose={closeSheet} />
      ) : null}

      {sheet === 'cost' && holding ? (
        <RedesignAddCostSheet holdingId={holding.id} onClose={closeSheet} />
      ) : null}

      {sheet === 'writeOff' && holding && figures ? (
        <RedesignWriteOffSheet
          holding={holding}
          currentValue={figures.value}
          onClose={closeSheet}
        />
      ) : null}

      <RedesignDialog
        visible={menuOpen}
        title={t('investments.more')}
        body={t('investments.redesign.moreBody')}
        confirmLabel={t('investments.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setMenuOpen(false)}
        onConfirm={() => {
          setMenuOpen(false);
          setRemoving(true);
        }}
        testID="redesign-holding-menu"
      />

      <RedesignDialog
        visible={removing}
        title={t('investments.removeTitle')}
        body={t('investments.removeBody')}
        confirmLabel={t('investments.removeConfirm')}
        destructive
        onCancel={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          if (!holding) return;
          void repo.archiveHolding(holding.id).then((r) => {
            if (!r.ok) {
              setError(
                r.error === 'not_positive' ? t('investments.removeHasUnits') : t('investments.redesign.error.save'),
              );
              return;
            }
            toast.show(t('investments.removed'));
            router.push('/investments');
          });
        }}
      />
    </RedesignStackFrame>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 48,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.border,
        gap: sp.md,
      }}
    >
      <RedesignText tone="textSecondary">{label}</RedesignText>
      <RedesignText style={{ fontVariant: ['tabular-nums'] }}>{value}</RedesignText>
    </View>
  );
}

export function redesignHoldingActive(): boolean {
  return isRedesignEnabled();
}
