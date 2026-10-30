import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
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

import { formatGain, portfolioSummary, type Range } from './helpers';
import { RedesignAddInvestmentSheet } from './redesignInvestmentSheets';

const sp = tokens.space;
const shape = tokens.shape;

function todayLagos() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

function typeLabel(type: string): string {
  return t(`investments.redesign.type.${type}` as 'investments.redesign.type.fund');
}

/**
 * Figma Mobile App Phone / Investments (5:1989) + Empty (13:6330).
 * Behind EXPO_PUBLIC_REDESIGN; W0 tokens/components only.
 */
export function RedesignInvestmentsScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const { privacy } = useDesign();
  const params = useGlobalSearchParams<{ range?: string; holding?: string; view?: string }>();
  const range = ((params.range as Range) || '1Y') as Range;
  const tableView = params.view === 'table';
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

  const empty = !!summary && summary.figures.length === 0;

  return (
    <RedesignStackFrame
      testID="redesign-investments"
      title={t('investments.title')}
      onBack={() => router.back()}
      trailing={
        empty ? (
          <View style={{ width: tokens.density.touch.minTarget }} />
        ) : (
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
              <RedesignText variant="label" tone="textSecondary">
                {t('investments.redesign.worthToday')}
              </RedesignText>
              <RedesignAmount
                testID="redesign-portfolio-value"
                text={formatNaira(summary.totalValue)}
                hidden={privacy}
                sizeVariant="display"
              />
              <RedesignText testID="redesign-portfolio-gain" tone="textSecondary">
                {privacy ? PRIVACY_MASK : gainLine}
              </RedesignText>
              <View
                testID="redesign-investments-range"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}
              >
                {(['1M', '3M', '1Y', 'All'] as Range[]).map((key) => (
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
                {summary.figures.map((f) => (
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
                    <RedesignText style={{ flex: 1.4 }} numberOfLines={1}>
                      {f.holding.name}
                    </RedesignText>
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
                {summary.figures.map((f) => {
                  const gain = formatGain(f.gain, null);
                  const subtitle = `${typeLabel(f.holding.type)}, ${privacy ? PRIVACY_MASK : gain}`;
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
