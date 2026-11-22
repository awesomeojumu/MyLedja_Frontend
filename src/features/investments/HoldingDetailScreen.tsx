import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Plus,
  Coins,
  ArrowUpRight,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { RecordDividendSheet } from './RecordDividendSheet';
import { SellHoldingSheet } from './SellHoldingSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { holdingFigures } from './positions';
import { pickAccount } from '../accounts/pickAccount';
import { valueOf } from '../../ledger/investments';
import { t } from '../../i18n';
import { Toast } from '../../design/components/Toast';

interface HoldingDetailScreenProps {
  holdingId: string;
}

export function HoldingDetailScreen({ holdingId }: HoldingDetailScreenProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { repo, holdings: dbHoldings, accounts, events: dbEvents, snapshot } = useDatabaseData();

  const matched = dbHoldings.find((h) => h.id === holdingId || h.symbol === holdingId);

  const ticker = matched?.symbol || matched?.name || holdingId || '';
  const name = matched?.name || '';
  const figures = React.useMemo(
    () => (matched ? holdingFigures(snapshot?.lots ?? [], snapshot?.prices ?? []).get(matched.id) : undefined),
    [matched, snapshot?.lots, snapshot?.prices],
  );
  const units = figures?.units ?? 0;
  const avgCostMinor = figures?.avgCostMinor ?? 0n;
  const currentPriceMinor = figures?.priceMinor ?? 0n;
  const [notice, setNotice] = useState('');

  // Sheets
  const [dividendVisible, setDividendVisible] = useState(false);
  const [sellVisible, setSellVisible] = useState(false);

  // History from the posted events for this holding.
  const events = React.useMemo(() => {
    if (!matched) return [];
    return dbEvents
      .filter((e) => e.status === 'posted' && (e.holdingId === matched.id || e.lines.some((l) => l.ledgerAccountId === matched.ledgerAccountId)))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => {
        const cash = e.lines.reduce((sum, l) => (l.ledgerAccountId !== matched.ledgerAccountId && l.amountMinor > 0n ? sum + l.amountMinor : sum), 0n);
        const kind = e.type === 'investment_buy' ? 'buy' : e.type === 'investment_sell' ? 'sell' : 'dividend';
        return {
          id: e.id,
          date: e.date,
          type: kind,
          description:
            kind === 'buy'
              ? t('holding.bought', { units: e.investmentUnits ?? '' })
              : kind === 'sell'
                ? t('holding.sold', { units: e.investmentUnits ?? '' })
                : t('holding.dividend'),
          amountMinor: cash,
        };
      });
  }, [matched, dbEvents]);

  const totalValueMinor = figures ? (figures.hasPrice ? valueOf(figures.unitsMicro, figures.priceMinor) : figures.costMinor) : 0n;
  const totalCostMinor = figures?.costMinor ?? 0n;
  const gainMinor = totalValueMinor - totalCostMinor;
  const gainPercent =
    totalCostMinor > 0n
      ? Math.round((Number(gainMinor) / Number(totalCostMinor)) * 100)
      : 0;

  const cashAccountId = pickAccount(accounts)?.id;

  const handleDividend = async (amountMinor: bigint) => {
    if (!matched || !cashAccountId) return;
    const res = await repo.recordDividend({
      holdingId: matched.id,
      amount: amountMinor,
      date: new Date().toISOString().slice(0, 10),
      cashAccountId,
    });
    setNotice(res.ok ? t('holding.saved') : t('holding.failed'));
  };

  const handleSale = async (soldUnits: number, priceMinor: bigint) => {
    if (!matched || !cashAccountId) return;
    const res = await repo.sellHolding({
      holdingId: matched.id,
      units: String(soldUnits),
      pricePerUnit: priceMinor,
      cashAccountId,
      date: new Date().toISOString().slice(0, 10),
    });
    setNotice(res.ok ? t('holding.saved') : t('holding.failed'));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.headerBar,
          {
            borderBottomColor: colors.borderSubtle,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { padding: spacing.xs }]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[
              styles.screenTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.lg,
              },
            ]}
          >
            {ticker}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {name}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Holding Value Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Holding Market Valuation
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(totalValueMinor)}
          </Text>

          <View
            style={[
              styles.gainRow,
              {
                borderTopColor: colors.borderSubtle,
                marginTop: spacing.md,
                paddingTop: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
            ]}
          >
            <View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.regular,
                }}
              >
                {units.toLocaleString()} units • Avg Cost: {formatNaira(avgCostMinor)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {gainMinor >= 0n ? (
                <TrendingUp size={16} color={colors.statusSuccess} />
              ) : (
                <TrendingDown size={16} color={colors.statusDanger} />
              )}
              <Text
                style={{
                  color: gainMinor >= 0n ? colors.statusSuccess : colors.statusDanger,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                  marginLeft: 4,
                }}
              >
                {gainMinor >= 0n ? '+' : ''}
                {formatNaira(gainMinor)} ({gainPercent > 0 ? `+${gainPercent}` : gainPercent}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Action Trio */}
        <View style={[styles.actionRow, { marginBottom: spacing.xl, gap: spacing.sm }]}>
          <TouchableOpacity
            onPress={() => setDividendVisible(true)}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.md,
                padding: spacing.md,
                flex: 1,
              },
            ]}
          >
            <Coins size={18} color={colors.primary} />
            <Text
              style={[
                styles.actionPillText,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                },
              ]}
            >
              + Dividend
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSellVisible(true)}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                flex: 1,
              },
            ]}
          >
            <ArrowUpRight size={18} color={colors.textPrimary} />
            <Text
              style={[
                styles.actionPillText,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                },
              ]}
            >
              Sell Shares
            </Text>
          </TouchableOpacity>
        </View>

        {/* Event Timeline */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Activity Timeline
        </Text>

        {events.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
              }}
            >
              No trading or dividend history recorded for this holding yet.
            </Text>
          </View>
        ) : (
          events.map((ev) => (
            <View
              key={ev.id}
              style={[
                styles.eventRow,
                {
                  borderBottomColor: colors.borderSubtle,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {ev.description}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {ev.date}
                </Text>
              </View>

              <Text
                style={{
                  color: ev.type === 'dividend' ? colors.statusSuccess : colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                {ev.type === 'dividend' ? '+' : ''}
                {formatNaira(ev.amountMinor)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Sheets */}
      <RecordDividendSheet
        visible={dividendVisible}
        onClose={() => setDividendVisible(false)}
        ticker={ticker}
        onSaveDividend={handleDividend}
      />

      <SellHoldingSheet
        visible={sellVisible}
        onClose={() => setSellVisible(false)}
        ticker={ticker}
        availableUnits={units}
        avgCostMinor={avgCostMinor}
        onConfirmSale={handleSale}
      />

      <Toast visible={!!notice} message={notice} onDismiss={() => setNotice('')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {},
  screenTitle: {},
  content: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
  },
  gainRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionPill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {},
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
