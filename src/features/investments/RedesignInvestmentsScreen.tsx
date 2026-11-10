import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useDesign } from '@/design/ThemeProvider';
import {
  RedesignAmount,
  RedesignButton,
  RedesignChip,
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
  portfolioSummary,
  type HoldingFigures,
  type Range,
} from './helpers';
import {
  RedesignAddInvestmentSheet,
  RedesignBatchValuationSheet,
} from './redesignInvestmentSheets';

const sp = tokens.space;
const shape = tokens.shape;

function todayLagos() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

function typeLabel(type: string): string {
  return t(`investments.redesign.type.${type}` as 'investments.redesign.type.fund');
}

type CategoryTab = 'all' | 'yield' | 'growth' | 'archived';

/**
 * Figma Mobile App Phone / Investments (5:1989) + Empty (13:6330)
 * Upgraded with Dual Asset Architecture (Cash flow / Yield vs Capital growth / Land),
 * Liquidity Tiers, Currency Toggle (NGN / USD), and Batch Valuations.
 */
export function RedesignInvestmentsScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const { privacy } = useDesign();
  const params = useGlobalSearchParams<{ range?: string; holding?: string; view?: string; tab?: string }>();
  const range = ((params.range as Range) || '1Y') as Range;
  const tableView = params.view === 'table';
  const [activeTab, setActiveTab] = useState<CategoryTab>((params.tab as CategoryTab) || 'all');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [batchOpen, setBatchOpen] = useState(false);

  const addOpen = params.holding === 'new';
  const openAdd = () => router.setParams({ holding: 'new' });
  const closeAdd = () => router.setParams({ holding: undefined });

  const summary = useMemo(
    () => (snapshot ? portfolioSummary(snapshot, range, todayLagos()) : null),
    [snapshot, range],
  );

  const gainLine = useMemo(() => {
    if (!summary) return '';
    const body = formatGain(summary.unrealised, summary.gainPct);
    return t('investments.redesign.sinceStarted', { gain: body });
  }, [summary]);

  const empty = !!summary && summary.figures.length === 0 && summary.archivedAssets.length === 0;

  // Filter figures based on active tab
  const displayedFigures = useMemo<HoldingFigures[]>(() => {
    if (!summary) return [];
    if (activeTab === 'yield') return summary.yieldAssets;
    if (activeTab === 'growth') return summary.growthAssets;
    if (activeTab === 'archived') return summary.archivedAssets;
    return summary.figures;
  }, [summary, activeTab]);

  // Annual passive income from yield assets
  const annualPassiveIncome = useMemo(() => {
    if (!summary) return 0n;
    return summary.dividends > 0n ? summary.dividends : 0n;
  }, [summary]);

  return (
    <RedesignStackFrame
      testID="redesign-investments"
      title={t('investments.title')}
      onBack={() => router.back()}
      trailing={
        empty ? (
          <View style={{ width: tokens.density.touch.minTarget }} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              testID="redesign-investments-batch-val"
              accessibilityRole="button"
              accessibilityLabel={t('investments.redesign.updateValuations')}
              onPress={() => setBatchOpen(true)}
              style={{
                width: tokens.density.touch.minTarget,
                height: tokens.density.touch.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RedesignIcon name="refresh" size={20} color={theme.text} />
            </Pressable>
            <Pressable
              testID="redesign-investments-add"
              accessibilityRole="button"
              accessibilityLabel={t('investments.redesign.addAction')}
              onPress={openAdd}
              style={{
                width: tokens.density.touch.minTarget,
                height: tokens.density.touch.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RedesignIcon name="plus" size={24} color={theme.text} />
            </Pressable>
          </View>
        )
      }
    >
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
        {!summary ? (
          <RedesignSkeleton height={180} testID="redesign-investments-skeleton" />
        ) : empty ? (
          <EmptyInvestments onAdd={openAdd} />
        ) : (
          <>
            {/* Portfolio Summary Card */}
            <View
              testID="redesign-investments-summary"
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
                <Pressable
                  testID="redesign-currency-toggle"
                  accessibilityRole="button"
                  onPress={() => setCurrency((c) => (c === 'NGN' ? 'USD' : 'NGN'))}
                  style={{
                    paddingHorizontal: sp.sm,
                    paddingVertical: sp.xs,
                    borderRadius: shape['radius-sm'],
                    backgroundColor: theme.surfaceMuted,
                  }}
                >
                  <RedesignText variant="caption">
                    {t('investments.redesign.currencyToggle', { currency })}
                  </RedesignText>
                </Pressable>
              </View>

              <RedesignAmount
                testID="redesign-portfolio-value"
                text={formatNaira(summary.totalValue)}
                hidden={privacy}
                sizeVariant="display"
              />

              <RedesignText testID="redesign-portfolio-gain" tone="textSecondary">
                {privacy ? PRIVACY_MASK : gainLine}
              </RedesignText>

              {/* Time Range Chips */}
              <View
                testID="redesign-investments-range"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}
              >
                {(['1M', '3M', '6M', '1Y', 'All'] as Range[]).map((key) => (
                  <RedesignChip
                    key={key}
                    testID={`redesign-range-${key}`}
                    label={key === 'All' ? t('investments.rangeAll') : key}
                    selected={range === key}
                    onPress={() => router.setParams({ range: key })}
                  />
                ))}
              </View>

              {summary.series.length > 1 ? (
                <RedesignLineChart
                  testID="redesign-investments-value-line"
                  points={summary.series.map((p) => ({ value: p.value }))}
                />
              ) : null}

              <RedesignButton
                testID="redesign-view-as-table"
                kind="link"
                label={tableView ? t('investments.redesign.viewAsList') : t('investments.redesign.viewAsTable')}
                onPress={() => router.setParams({ view: tableView ? undefined : 'table' })}
              />
            </View>

            {/* Liquidity Profile Bar */}
            <View
              testID="redesign-liquidity-bar"
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                padding: sp.md,
                gap: sp.sm,
              }}
            >
              <RedesignText variant="caption" tone="textSecondary">
                {t('investments.redesign.liquidityTitle')}
              </RedesignText>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.surfaceMuted,
                  flexDirection: 'row',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    flex: summary.liquidity.liquid.pct || 1,
                    backgroundColor: theme.primary,
                  }}
                />
                <View
                  style={{
                    flex: summary.liquidity.semiLiquid.pct || 1,
                    backgroundColor: theme.progressFill,
                  }}
                />
                <View
                  style={{
                    flex: summary.liquidity.illiquid.pct || 1,
                    backgroundColor: theme.textSecondary,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: sp.xs }}>
                <RedesignText variant="helper" tone="textSecondary">
                  {t('investments.redesign.liquidityLiquid', { pct: summary.liquidity.liquid.pct })}
                </RedesignText>
                <RedesignText variant="helper" tone="textSecondary">
                  {t('investments.redesign.liquiditySemiLiquid', { pct: summary.liquidity.semiLiquid.pct })}
                </RedesignText>
                <RedesignText variant="helper" tone="textSecondary">
                  {t('investments.redesign.liquidityIlliquid', { pct: summary.liquidity.illiquid.pct })}
                </RedesignText>
              </View>
            </View>

            {/* Category Bifurcation Tabs */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
              <RedesignChip
                testID="redesign-category-all"
                label={`${t('investments.redesign.categoryAll')} (${summary.figures.length})`}
                selected={activeTab === 'all'}
                onPress={() => setActiveTab('all')}
              />
              <RedesignChip
                testID="redesign-category-yield"
                label={`${t('investments.redesign.categoryYield')} (${summary.yieldAssets.length})`}
                selected={activeTab === 'yield'}
                onPress={() => setActiveTab('yield')}
              />
              <RedesignChip
                testID="redesign-category-growth"
                label={`${t('investments.redesign.categoryGrowth')} (${summary.growthAssets.length})`}
                selected={activeTab === 'growth'}
                onPress={() => setActiveTab('growth')}
              />
              {summary.archivedAssets.length > 0 ? (
                <RedesignChip
                  testID="redesign-category-archived"
                  label={`${t('investments.redesign.categoryArchived')} (${summary.archivedAssets.length})`}
                  selected={activeTab === 'archived'}
                  onPress={() => setActiveTab('archived')}
                />
              ) : null}
            </View>

            {/* Special Callouts per tab */}
            {activeTab === 'yield' && annualPassiveIncome > 0n ? (
              <View
                testID="redesign-passive-income-card"
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: shape['radius-md'],
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: sp.md,
                }}
              >
                <RedesignText variant="label">
                  {t('investments.redesign.annualPassiveIncome', { amount: formatNaira(annualPassiveIncome) })}
                </RedesignText>
              </View>
            ) : null}

            {activeTab === 'archived' && summary.portfolioDrag > 0 ? (
              <View
                testID="redesign-portfolio-drag-card"
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: shape['radius-md'],
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: sp.md,
                  gap: sp.xs,
                }}
              >
                <RedesignText variant="label">
                  {t('investments.redesign.portfolioDrag', { drag: summary.portfolioDrag })}
                </RedesignText>
                <RedesignText variant="caption" tone="textSecondary">
                  {t('investments.redesign.writtenOffLosses', { amount: formatNaira(summary.writtenOffLossTotal) })}
                </RedesignText>
              </View>
            ) : null}

            <RedesignText variant="label" tone="textSecondary">
              {t('investments.redesign.holdings')}
            </RedesignText>

            {tableView ? (
              <View
                testID="redesign-investments-table"
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
                  <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1.4 }}>
                    {t('investments.holding')}
                  </RedesignText>
                  <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
                    {t('investments.value')}
                  </RedesignText>
                  <RedesignText variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
                    {t('investments.gain')}
                  </RedesignText>
                </View>
                {displayedFigures.map((f) => (
                  <Pressable
                    key={f.holding.id}
                    testID={`redesign-holding-row-${f.holding.id}`}
                    accessibilityRole="button"
                    onPress={() => router.push(`/investments/${f.holding.id}`)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: sp.md,
                      paddingVertical: sp.md,
                      borderTopWidth: 1,
                      borderTopColor: theme.border,
                      gap: sp.sm,
                      minHeight: tokens.size['list-row'],
                    }}
                  >
                    <View style={{ flex: 1.4 }}>
                      <RedesignText numberOfLines={1}>{f.holding.name}</RedesignText>
                      {f.holding.location ? (
                        <RedesignText variant="helper" tone="textSecondary" numberOfLines={1}>
                          {f.holding.location}
                        </RedesignText>
                      ) : null}
                    </View>
                    <RedesignText
                      variant="label"
                      style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                      numberOfLines={1}
                    >
                      {privacy ? PRIVACY_MASK : formatNaira(f.value)}
                    </RedesignText>
                    <RedesignText
                      variant="helper"
                      tone="textSecondary"
                      style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                      numberOfLines={1}
                    >
                      {privacy ? PRIVACY_MASK : formatGain(f.gain, f.gainPct)}
                    </RedesignText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View
                testID="redesign-investments-holdings"
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: shape['radius-lg'],
                  borderWidth: 1,
                  borderColor: theme.border,
                  overflow: 'hidden',
                }}
              >
                {displayedFigures.map((f) => {
                  const gain = formatGain(f.gain, null);
                  const extra = f.cagr !== null ? ` · ${f.cagr}% p.a.` : '';
                  const location = f.holding.location ? `${f.holding.location} · ` : '';
                  const subtitle = `${location}${typeLabel(f.holding.type)}, ${privacy ? PRIVACY_MASK : gain}${extra}`;
                  return (
                    <RedesignListRow
                      key={f.holding.id}
                      testID={`redesign-holding-row-${f.holding.id}`}
                      title={f.holding.name}
                      subtitle={subtitle}
                      trailing={privacy ? PRIVACY_MASK : formatNaira(f.value)}
                      onPress={() => router.push(`/investments/${f.holding.id}`)}
                    />
                  );
                })}
              </View>
            )}

            <RedesignText variant="helper" tone="textSecondary" style={{ textAlign: 'center' }}>
              {t('investments.redesign.freshness')}
            </RedesignText>
          </>
        )}
      </ScrollView>

      {addOpen ? (
        <RedesignAddInvestmentSheet
          onClose={closeAdd}
          onCreated={(h) => {
            router.push(`/investments/${h.id}`);
          }}
        />
      ) : null}

      {batchOpen && summary ? (
        <RedesignBatchValuationSheet
          holdings={summary.figures.map((f) => ({ holding: f.holding, currentValue: f.value }))}
          onClose={() => setBatchOpen(false)}
        />
      ) : null}
    </RedesignStackFrame>
  );
}

function EmptyInvestments({ onAdd }: { onAdd: () => void }) {
  return (
    <View
      testID="redesign-investments-empty"
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        padding: sp.xl,
        alignItems: 'center',
        gap: sp.md,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RedesignIcon name="trending-up" size={24} color={theme.text} />
      </View>
      <RedesignText variant="label">{t('investments.redesign.emptyTitle')}</RedesignText>
      <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
        {t('investments.redesign.emptyBody')}
      </RedesignText>
      <RedesignButton
        testID="redesign-investments-empty-add"
        label={t('investments.redesign.addAction')}
        onPress={onAdd}
      />
    </View>
  );
}

/** Guard helper for tests / static analysis — redesign path only when flag on. */
export function redesignInvestmentsActive(): boolean {
  return isRedesignEnabled();
}
