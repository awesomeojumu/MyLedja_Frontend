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
  Building2,
  Landmark,
  Coins,
  Shield,
  Briefcase,
  MapPin,
  SlidersHorizontal,
  ChevronDown,
  Check,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira, parseAmount } from '../../money';
import { RecordTradeSheet, type AddedTrade } from './RecordTradeSheet';
import { QuickPriceUpdateSheet, type PriceHoldingItem } from './QuickPriceUpdateSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import type { HoldingType, HoldingUnitType } from '../../data/workspace/model';

interface HoldingItemUI {
  id: string;
  ticker: string;
  name: string;
  type: HoldingType;
  unitType?: HoldingUnitType;
  units: number;
  avgCostMinor: bigint;
  currentPriceMinor: bigint;
  location?: string;
}

function getAssetTypeMeta(type: HoldingType) {
  switch (type) {
    case 'realEstate':
    case 'land':
      return { label: 'Real Estate', icon: Building2, color: '#059669' };
    case 'fixedDeposit':
      return { label: 'Fixed Income', icon: Landmark, color: '#D97706' };
    case 'crypto':
      return { label: 'Crypto', icon: Coins, color: '#7C3AED' };
    case 'fund':
      return { label: 'Mutual Fund', icon: PieChart, color: '#2563EB' };
    case 'preciousMetals':
      return { label: 'Precious Metals', icon: Shield, color: '#E11D48' };
    case 'privateEquity':
      return { label: 'Business Venture', icon: Briefcase, color: '#0D9488' };
    case 'pension':
      return { label: 'Retirement', icon: Shield, color: '#4B5563' };
    case 'stock':
    default:
      return { label: 'Equities', icon: TrendingUp, color: '#2563EB' };
  }
}

function formatUnits(units: number, unitType?: HoldingUnitType, type?: HoldingType) {
  if (unitType === 'plots' || type === 'land') return `${units} plot${units > 1 ? 's' : ''}`;
  if (unitType === 'acres') return `${units} acre${units > 1 ? 's' : ''}`;
  if (unitType === 'sqm') return `${units} sqm`;
  if (unitType === 'grams') return `${units}g`;
  if (unitType === 'ounces') return `${units} oz`;
  if (unitType === 'shares' || type === 'stock') return `${units.toLocaleString()} sh`;
  if (unitType === 'lumpSum' || type === 'fixedDeposit') return `${units.toLocaleString()} lot${units > 1 ? 's' : ''}`;
  return `${units.toLocaleString()} units`;
}

export function InvestmentsScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { repo, holdings: dbHoldings, accounts: dbAccounts } = useDatabaseData();

  // State
  const [localHoldings, setLocalHoldings] = useState<HoldingItemUI[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const filterOptions: { id: string; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
    { id: 'all', label: 'All Assets', icon: PieChart },
    { id: 'stock', label: 'Stocks & Equities', icon: TrendingUp },
    { id: 'realEstate', label: 'Real Estate & Land', icon: Building2 },
    { id: 'fixedDeposit', label: 'Fixed Income & T-Bills', icon: Landmark },
    { id: 'fund', label: 'Mutual Funds & ETFs', icon: PieChart },
    { id: 'crypto', label: 'Crypto & Digital', icon: Coins },
    { id: 'privateEquity', label: 'Business & Ventures', icon: Briefcase },
    { id: 'preciousMetals', label: 'Precious Metals', icon: Shield },
  ];

  const holdings: HoldingItemUI[] = React.useMemo(() => {
    if (dbHoldings.length > 0) {
      return dbHoldings.map((h, idx) => ({
        id: h.id,
        ticker: h.symbol || h.name,
        name: h.name,
        type: h.type || 'stock',
        unitType: h.unitType,
        units: 1000 * (idx + 1),
        avgCostMinor: 25000n,
        currentPriceMinor: 28500n,
        location: h.location,
      }));
    }
    return localHoldings;
  }, [dbHoldings, localHoldings]);

  const filteredHoldings = React.useMemo(() => {
    if (selectedCategory === 'all') return holdings;
    if (selectedCategory === 'realEstate') {
      return holdings.filter((h) => h.type === 'realEstate' || h.type === 'land');
    }
    return holdings.filter((h) => h.type === selectedCategory);
  }, [holdings, selectedCategory]);

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
        type: trade.type,
        accountId: dbAccounts[0]!.id,
        currentPriceMinor: trade.priceMinor,
        unitType: trade.unitType,
        location: trade.location,
      }).catch((e: unknown) => console.warn('Failed to record holding in DB', e));
    }
    setLocalHoldings((prev) => {
      const existing = prev.find((h) => h.ticker === trade.ticker && h.name === trade.name);
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
            type: trade.type,
            unitType: trade.unitType,
            units: trade.units,
            avgCostMinor: trade.priceMinor,
            currentPriceMinor: trade.priceMinor,
            location: trade.location,
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

        {/* Holdings List Header & Single Filter Button */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
            position: 'relative',
            zIndex: 30,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.md,
            }}
          >
            Assets & Holdings ({filteredHoldings.length})
          </Text>

          {/* Single Filter Button */}
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              onPress={() => setFilterMenuOpen((prev) => !prev)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: selectedCategory !== 'all' ? colors.primaryLight : colors.surface,
                borderColor: selectedCategory !== 'all' ? colors.primary : colors.borderSubtle,
                borderWidth: selectedCategory !== 'all' ? 1.5 : 1,
                borderRadius: radii.md,
                paddingVertical: 6,
                paddingHorizontal: 12,
                gap: 6,
              }}
            >
              <SlidersHorizontal
                size={14}
                color={selectedCategory !== 'all' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={{
                  color: selectedCategory !== 'all' ? colors.primary : colors.textPrimary,
                  fontFamily: selectedCategory !== 'all' ? typography.fonts.semiBold : typography.fonts.medium,
                  fontSize: 12,
                }}
              >
                {selectedCategory !== 'all'
                  ? (filterOptions.find((f) => f.id === selectedCategory)?.label ?? 'Filter')
                  : 'Filter'}
              </Text>

              {selectedCategory !== 'all' ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedCategory('all');
                    setFilterMenuOpen(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 2 }}
                >
                  <X size={13} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <ChevronDown
                  size={14}
                  color={filterMenuOpen ? colors.primary : colors.textSecondary}
                />
              )}
            </TouchableOpacity>

            {/* Filter Menu Popover */}
            {filterMenuOpen && (
              <View
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 0,
                  width: 230,
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: radii.md,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 8,
                  zIndex: 99,
                  overflow: 'hidden',
                }}
              >
                {filterOptions.map((opt, idx) => {
                  const isSelected = selectedCategory === opt.id;
                  const IconComp = opt.icon;
                  const count =
                    opt.id === 'all'
                      ? holdings.length
                      : opt.id === 'realEstate'
                      ? holdings.filter((h) => h.type === 'realEstate' || h.type === 'land').length
                      : holdings.filter((h) => h.type === opt.id).length;

                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        setSelectedCategory(opt.id);
                        setFilterMenuOpen(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                        borderBottomWidth: idx < filterOptions.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: colors.borderSubtle,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <IconComp size={14} color={isSelected ? colors.primary : colors.textSecondary} />
                        <Text
                          style={{
                            color: isSelected ? colors.primary : colors.textPrimary,
                            fontFamily: isSelected ? typography.fonts.semiBold : typography.fonts.regular,
                            fontSize: 12,
                          }}
                        >
                          {opt.label}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {count > 0 && (
                          <View
                            style={{
                              backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                              borderRadius: radii.full,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected ? '#FFFFFF' : colors.textSecondary,
                                fontSize: 10,
                                fontFamily: typography.fonts.semiBold,
                              }}
                            >
                              {count}
                            </Text>
                          </View>
                        )}
                        {isSelected && <Check size={13} color={colors.primary} strokeWidth={2.5} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {filteredHoldings.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.xl,
              alignItems: 'center',
              borderWidth: 1,
            }}
          >
            <PieChart size={32} color={colors.textTertiary} style={{ marginBottom: spacing.sm }} />
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              {selectedCategory === 'all'
                ? 'No Investment Holdings Yet'
                : 'No Holdings in this Category'}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: 12,
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              Tap "+ Record Trade" to acquire Stocks, Real Estate, Fixed Deposits, Funds, or Crypto.
            </Text>
          </View>
        ) : (
          filteredHoldings.map((h) => {
            const itemValueMinor =
              (h.currentPriceMinor * BigInt(Math.round(h.units * 100))) / 100n;
            const itemCostMinor =
              (h.avgCostMinor * BigInt(Math.round(h.units * 100))) / 100n;
            const itemGainMinor = itemValueMinor - itemCostMinor;
            const meta = getAssetTypeMeta(h.type);
            const IconComponent = meta.icon;

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
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                      },
                    ]}
                  >
                    <IconComponent size={20} color={colors.primary} />
                  </View>

                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: typography.fonts.semiBold,
                          fontSize: typography.sizes.bodySm,
                        }}
                      >
                        {h.name}
                      </Text>
                      <View
                        style={{
                          backgroundColor: colors.surfaceSubtle,
                          borderRadius: radii.sm,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: typography.fonts.medium }}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: typography.sizes.xs,
                        fontFamily: typography.fonts.regular,
                        marginTop: 2,
                      }}
                    >
                      {formatUnits(h.units, h.unitType, h.type)}
                      {h.type === 'stock' || h.type === 'crypto' || h.type === 'fund'
                        ? ` • ${formatNaira(h.currentPriceMinor)}/unit`
                        : ''}
                      {h.location ? ` • 📍 ${h.location}` : ''}
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
          })
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
