import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useToast } from '@/design/components';
import { useDesign } from '@/design/ThemeProvider';
import {
  RedesignAmount,
  RedesignButton,
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
  lotsFor,
  pricesFor,
  type Range,
} from './helpers';
import { RedesignAddMoneySheet, RedesignUpdateValueSheet } from './redesignInvestmentSheets';

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

/**
 * Figma Mobile App Phone / Holding (5:2062) + Update value (5:2131).
 * Behind EXPO_PUBLIC_REDESIGN; W0 tokens/components only.
 */
export function RedesignHoldingScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const { privacy } = useDesign();
  const toast = useToast();
  const params = useGlobalSearchParams<{ id?: string; sheet?: string }>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = params.sheet === 'update' || params.sheet === 'add' ? params.sheet : null;
  const openSheet = (s: 'update' | 'add') => router.setParams({ sheet: s });
  const closeSheet = () => router.setParams({ sheet: undefined });

  const holding = snapshot?.holdings.find((h) => h.id === params.id);
  const account = snapshot && holding ? snapshot.accounts.find((a) => a.id === holding.accountId) : undefined;
  const onDate = todayLagos();
  const figures = snapshot && holding ? holdingFigures(snapshot, holding) : null;
  const series = snapshot && holding ? holdingSeries(snapshot, holding, '1Y' as Range, onDate) : [];
  const prices = snapshot && holding ? pricesFor(snapshot, holding.id) : [];
  const lots = snapshot && holding ? lotsFor(snapshot, holding.id) : [];

  type HistoryRow = { id: string; kind: 'value' | 'money'; title: string; date: string; trailing: string; sort: string };
  const history: HistoryRow[] = [];
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
      if (e.status !== 'posted' || e.type !== 'investment_buy') continue;
      if (e.holdingId !== holding.id && !e.lines.some((l) => l.ledgerAccountId === holding.ledgerAccountId)) continue;
      const amount =
        e.lines.find((l) => l.ledgerAccountId === holding.ledgerAccountId)?.amountMinor ??
        e.lines.find((l) => l.amountMinor < 0n)?.amountMinor ??
        0n;
      const abs = amount < 0n ? -amount : amount;
      history.push({
        id: `buy-${e.id}`,
        kind: 'money',
        title: t('investments.redesign.historyAddedMoney'),
        date: e.date,
        trailing: `+${formatNaira(abs)}`,
        sort: `${e.date}-b-${e.id}`,
      });
    }
    history.sort((a, b) => b.sort.localeCompare(a.sort));
  }

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
              <RedesignText variant="label" tone="textSecondary">
                {t('investments.redesign.worthToday')}
              </RedesignText>
              <RedesignAmount
                testID="redesign-holding-amount"
                text={formatNaira(figures.value)}
                hidden={privacy}
                sizeVariant="display"
              />
              <RedesignText testID="redesign-holding-gain" tone="textSecondary">
                {privacy ? PRIVACY_MASK : gainCaption}
              </RedesignText>
              {series.length > 1 ? (
                <RedesignLineChart
                  testID="redesign-holding-chart"
                  points={series.map((p) => ({ value: p.value }))}
                />
              ) : null}
            </View>

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
              <DetailRow
                label={t('investments.redesign.youPutIn')}
                value={privacy ? PRIVACY_MASK : formatNaira(figures.cost)}
              />
              <DetailRow label={t('investments.units')} value={formatUnits(figures.units)} />
              <DetailRow
                label={t('investments.redesign.countsInBudget')}
                value={account?.countInBudget ? t('common.yes') : t('common.no')}
                last
              />
            </View>

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

            {error ? (
              <RedesignText testID="redesign-holding-error" style={{ color: theme.danger }}>
                {error}
              </RedesignText>
            ) : null}
          </>
        )}
      </ScrollView>

      {holding && figures ? (
        <View
          style={{
            flexDirection: 'row',
            gap: sp.sm,
            paddingTop: sp.md,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.page,
          }}
        >
          <View style={{ flex: 1 }}>
            <RedesignButton
              testID="redesign-holding-update"
              label={t('investments.redesign.updateValue')}
              onPress={() => openSheet('update')}
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <RedesignButton
              testID="redesign-holding-add-money"
              kind="secondary"
              label={t('investments.redesign.addMoney')}
              onPress={() => openSheet('add')}
              fullWidth
            />
          </View>
        </View>
      ) : null}

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
