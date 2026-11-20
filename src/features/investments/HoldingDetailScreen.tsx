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

interface HoldingDetailScreenProps {
  holdingId: string;
}

export function HoldingDetailScreen({ holdingId }: HoldingDetailScreenProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { holdings: dbHoldings } = useDatabaseData();

  const matched = dbHoldings.find((h) => h.id === holdingId || h.symbol === holdingId);

  // State
  const ticker = matched?.symbol || holdingId || 'Asset';
  const name = matched?.name || 'Investment Holding';
  const [units, setUnits] = useState(0);
  const [avgCostMinor, setAvgCostMinor] = useState(0n);
  const [currentPriceMinor, setCurrentPriceMinor] = useState(0n);

  // Sheets
  const [dividendVisible, setDividendVisible] = useState(false);
  const [sellVisible, setSellVisible] = useState(false);

  // Real events history
  const [events, setEvents] = useState<Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    amountMinor: bigint;
  }>>([]);

  const totalValueMinor =
    (currentPriceMinor * BigInt(Math.round(units * 100))) / 100n;
  const totalCostMinor =
    (avgCostMinor * BigInt(Math.round(units * 100))) / 100n;
  const gainMinor = totalValueMinor - totalCostMinor;
  const gainPercent =
    totalCostMinor > 0n
      ? Math.round((Number(gainMinor) / Number(totalCostMinor)) * 100)
      : 0;

  const handleDividend = (amountMinor: bigint) => {
    setEvents((prev) => [
      {
        id: `div-${Date.now()}`,
        date: 'Today',
        type: 'dividend',
        description: 'Dividend Payout Received',
        amountMinor,
      },
      ...prev,
    ]);
  };

  const handleSale = (soldUnits: number, priceMinor: bigint) => {
    setUnits((prev) => Math.max(0, prev - soldUnits));
    setEvents((prev) => [
      {
        id: `sell-${Date.now()}`,
        date: 'Today',
        type: 'sell',
        description: `Sold ${soldUnits} units @ ${formatNaira(priceMinor)}`,
        amountMinor: (priceMinor * BigInt(Math.round(soldUnits * 100))) / 100n,
      },
      ...prev,
    ]);
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
