import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  PieChart,
  Building2,
  Landmark,
  Coins,
  Shield,
  Briefcase,
  SlidersHorizontal,
  ChevronDown,
  Check,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { RecordTradeSheet, type AddedTrade } from './RecordTradeSheet';
import { holdingFigures } from './positions';
import { t } from '../../i18n';
import { Toast } from '../../design/components/Toast';
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
  const { repo, holdings: dbHoldings, accounts: dbAccounts, snapshot } = useDatabaseData();
  const [notice, setNotice] = useState('');

  // State
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

  const figures = React.useMemo(
    () => holdingFigures(snapshot?.lots ?? [], snapshot?.prices ?? []),
    [snapshot?.lots, snapshot?.prices],
  );

  // Real positions: units and cost from the lots, value from the latest price entered.
  const holdings: HoldingItemUI[] = React.useMemo(
    () =>
      dbHoldings
        .filter((h) => !h.archived && !h.isWrittenOff)
        .map((h) => {
          const f = figures.get(h.id);
          return {
            id: h.id,
            ticker: h.symbol || h.name,
            name: h.name,
            type: h.type || 'stock',
            unitType: h.unitType,
            units: f?.units ?? 0,
            avgCostMinor: f?.avgCostMinor ?? 0n,
            currentPriceMinor: f?.priceMinor ?? 0n,
            location: h.location,
          };
        }),
    [dbHoldings, figures],
  );

  const filteredHoldings = React.useMemo(() => {
    if (selectedCategory === 'all') return holdings;
    if (selectedCategory === 'realEstate') {
      return holdings.filter((h) => h.type === 'realEstate' || h.type === 'land');
    }
    return holdings.filter((h) => h.type === selectedCategory);
  }, [holdings, selectedCategory]);

  // Sheets
  const [tradeSheetVisible, setTradeSheetVisible] = useState(false);

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

  /** Holdings live in an investment account; the first trade makes one if there isn't one yet. */
  const investmentAccountId = async (): Promise<string | null> => {
    const existing = dbAccounts.find((a) => a.type === 'investment' && !a.archived);
    if (existing) return existing.id;
    const made = await repo.addAccount({
      name: t('invest.accountName'),
      type: 'investment',
      purpose: 'investment',
      openingBalance: 0n,
      openingDate: new Date().toISOString().slice(0, 10),
    });
    return made.ok ? made.value.id : null;
  };

  const handleTrade = async (trade: AddedTrade) => {
    const date = new Date().toISOString().slice(0, 10);
    const units = String(trade.units);
    const known =
      dbHoldings.find((h) => h.id === trade.holdingId) ??
      dbHoldings.find(
        (h) =>
          !h.archived &&
          ((trade.ticker && h.symbol?.toUpperCase() === trade.ticker.toUpperCase()) ||
            h.name.toLowerCase() === trade.name.toLowerCase()),
      );
    let ok = false;
    if (trade.action === 'sell') {
      if (known) {
        const res = await repo.sellHolding({
          holdingId: known.id,
          units,
          pricePerUnit: trade.priceMinor,
          fees: trade.feesMinor,
          cashAccountId: trade.cashAccountId,
          date,
        });
        ok = res.ok;
      }
    } else {
      let holdingId = known?.id;
      if (!holdingId) {
        const parent = await investmentAccountId();
        if (parent) {
          const created = await repo.createHolding({
            name: trade.name,
            symbol: trade.ticker,
            type: trade.type,
            accountId: parent,
            currentPriceMinor: trade.priceMinor,
            unitType: trade.unitType,
            location: trade.location,
          });
          if (created.ok) holdingId = created.value.id;
        }
      }
      if (holdingId) {
        const res = await repo.buyHolding({
          holdingId,
          units,
          pricePerUnit: trade.priceMinor,
          fees: trade.feesMinor,
          cashAccountId: trade.cashAccountId,
          date,
        });
        ok = res.ok;
      }
    }
    setNotice(ok ? t(trade.action === 'sell' ? 'invest.sold' : 'invest.saved', { name: trade.name }) : t('invest.failed'));
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
            {t('ui.investmentsScreen.investmentsPortfolio')}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {t('ui.investmentsScreen.equitiesAndAssetHoldings')}
          </Text>
        </View>

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
            {t('ui.investmentsScreen.recordInvestment')}
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
            {t('ui.investmentsScreen.totalPortfolioValue')}
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
                {t('ui.investmentsScreen.costBasis')}{' '}{formatNaira(totalCostMinor)}
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
            {t('ui.investmentsScreen.assetsAndHoldings')}{filteredHoldings.length})
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
              {t('ui.investmentsScreen.tapRecordInvestmentToAcquire')}
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
        existingHoldings={holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker,
          name: h.name,
          units: h.units,
          type: h.type,
          unitType: h.unitType,
        }))}
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
