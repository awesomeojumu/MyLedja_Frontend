import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  PieChart,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira, parseAmount } from '../../money';
import { RecordTradeSheet, type AddedTrade } from './RecordTradeSheet';
import { QuickPriceUpdateSheet, type PriceHoldingItem } from './QuickPriceUpdateSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface HoldingItemUI {
  id: string;
  ticker: string;
  name: string;
  units: number;
  avgCostMinor: bigint;
  currentPriceMinor: bigint;
}

export function InvestmentsScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { repo, holdings: dbHoldings, accounts: dbAccounts } = useDatabaseData();

  // State
  const [localHoldings, setLocalHoldings] = useState<HoldingItemUI[]>([]);

  const holdings: HoldingItemUI[] = React.useMemo(() => {
    if (dbHoldings.length > 0) {
      return dbHoldings.map((h, idx) => ({
        id: h.id,
        ticker: h.symbol || h.name,
        name: h.name,
        units: 1000 * (idx + 1),
        avgCostMinor: 25000n,
        currentPriceMinor: 28500n,
      }));
    }
    return localHoldings;
  }, [dbHoldings, localHoldings]);

  // Sheets
  const [tradeSheetVisible, setTradeSheetVisible] = useState(false);
  const [priceSheetVisible, setPriceSheetVisible] = useState(false);

  // Totals calculation
  const totalCostMinor = holdings.reduce(
    (sum, h) => sum + (h.avgCostMinor * BigInt(Math.round(h.units * 100))) / 100n,
    0n
  );
  const totalValueMinor = holdings.reduce(
    (sum, h) => sum + (h.currentPriceMinor * BigInt(Math.round(h.units * 100))) / 100n,
    0n
  );
  const totalGainMinor = totalValueMinor - totalCostMinor;
  const gainPercent =
    totalCostMinor > 0n
      ? Math.round((Number(totalGainMinor) / Number(totalCostMinor)) * 100)
      : 0;

  const handleTrade = (trade: AddedTrade) => {
    if (repo && dbAccounts.length > 0) {
      repo.createHolding({
        name: trade.name,
        symbol: trade.ticker,
        type: 'stock',
        accountId: dbAccounts[0]!.id,
        currentPriceMinor: trade.priceMinor,
      }).catch((e: unknown) => console.warn('Failed to record holding in DB', e));
    }
    setLocalHoldings((prev) => {
      const existing = prev.find((h) => h.ticker === trade.ticker);
      if (existing) {
        if (trade.action === 'buy') {
          const totalExistingCost =
            (existing.avgCostMinor * BigInt(Math.round(existing.units * 100))) / 100n;
          const newTradeCost =
            (trade.priceMinor * BigInt(Math.round(trade.units * 100))) / 100n;
          const nextUnits = existing.units + trade.units;
          const nextAvg = (totalExistingCost + newTradeCost) / BigInt(Math.round(nextUnits));

          return prev.map((h) =>
            h.id === existing.id
              ? {
                  ...h,
                  units: nextUnits,
                  avgCostMinor: nextAvg,
                  currentPriceMinor: trade.priceMinor,
                }
              : h
          );
        } else {
          const nextUnits = Math.max(0, existing.units - trade.units);
          return prev.map((h) =>
            h.id === existing.id ? { ...h, units: nextUnits } : h
          );
        }
      } else {
        return [
          ...prev,
          {
            id: `h-${Date.now()}`,
            ticker: trade.ticker,
            name: trade.name,
            units: trade.units,
            avgCostMinor: trade.priceMinor,
            currentPriceMinor: trade.priceMinor,
          },
        ];
      }
    });
  };

  const handleSavePrices = (prices: Record<string, string>) => {
    setLocalHoldings((prev) =>
      prev.map((h) => {
        const text = prices[h.id];
        if (!text) return h;
        const parsed = parseAmount(text);
        return parsed.ok ? { ...h, currentPriceMinor: parsed.minor } : h;
      })
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
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
            Investments Portfolio
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Equities & Asset Holdings
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setPriceSheetVisible(true)}
          style={[
            styles.headerIconBtn,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: spacing.xs,
              marginRight: spacing.xs,
            },
          ]}
        >
          <RefreshCw size={16} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTradeSheetVisible(true)}
          style={[
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            },
          ]}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            Record Trade
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio Value Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
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
            Total Portfolio Value
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
                Cost Basis: {formatNaira(totalCostMinor)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {totalGainMinor >= 0n ? (
                <TrendingUp size={16} color={colors.statusSuccess} />
              ) : (
                <TrendingDown size={16} color={colors.statusDanger} />
              )}
              <Text
                style={{
                  color: totalGainMinor >= 0n ? colors.statusSuccess : colors.statusDanger,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                  marginLeft: 4,
                }}
              >
                {totalGainMinor >= 0n ? '+' : ''}
                {formatNaira(totalGainMinor)} ({gainPercent > 0 ? `+${gainPercent}` : gainPercent}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Holdings List */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Assets & Holdings ({holdings.length})
        </Text>

        {holdings.map((h) => {
          const itemValueMinor =
            (h.currentPriceMinor * BigInt(Math.round(h.units * 100))) / 100n;
          const itemCostMinor =
            (h.avgCostMinor * BigInt(Math.round(h.units * 100))) / 100n;
          const itemGainMinor = itemValueMinor - itemCostMinor;

          return (
            <TouchableOpacity
              key={h.id}
              onPress={() => router.push(`/investments/${h.id}` as any)}
              style={[
                styles.holdingCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={[
                    styles.tickerBadge,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.md,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: 12,
                    }}
                  >
                    {h.ticker.slice(0, 4)}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                    }}
                  >
                    {h.ticker}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      fontFamily: typography.fonts.regular,
                    }}
                  >
                    {h.units.toLocaleString()} units • {formatNaira(h.currentPriceMinor)}/sh
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                    }}
                  >
                    {formatNaira(itemValueMinor)}
                  </Text>
                  <Text
                    style={{
                      color: itemGainMinor >= 0n ? colors.statusSuccess : colors.statusDanger,
                      fontSize: 11,
                      fontFamily: typography.fonts.medium,
                    }}
                  >
                    {itemGainMinor >= 0n ? '+' : ''}
                    {formatNaira(itemGainMinor)}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textTertiary} style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>
          );
        })}

        {holdings.length === 0 && (
          <View
            style={[
              styles.holdingCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.xl,
                padding: spacing.xl,
                alignItems: 'center',
                marginTop: spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: spacing.xs,
              }}
            >
              No investment holdings yet
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
                textAlign: 'center',
                marginBottom: spacing.md,
              }}
            >
              Track your NGX stocks, US equities, mutual funds, Eurobonds, and real estate assets.
            </Text>
            <TouchableOpacity
              onPress={() => setTradeSheetVisible(true)}
              activeOpacity={0.8}
              style={[
                styles.addBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radii.lg,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm + 2,
                },
              ]}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                + Record Trade / Asset
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Sheets */}
      <RecordTradeSheet
        visible={tradeSheetVisible}
        onClose={() => setTradeSheetVisible(false)}
        onSave={handleTrade}
      />

      <QuickPriceUpdateSheet
        visible={priceSheetVisible}
        onClose={() => setPriceSheetVisible(false)}
        holdings={holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker,
          currentPriceMinor: h.currentPriceMinor,
        }))}
        onSavePrices={handleSavePrices}
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
  headerIconBtn: {},
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
  },
  gainRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  holdingCard: {
    borderWidth: 1,
  },
  tickerBadge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
