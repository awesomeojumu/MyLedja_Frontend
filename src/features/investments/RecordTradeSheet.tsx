import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  TrendingUp,
  Building2,
  Landmark,
  PieChart,
  Coins,
  Shield,
  Briefcase,
  MapPin,
} from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';
import type { HoldingType, HoldingUnitType } from '../../data/workspace/model';

export interface AddedTrade {
  id: string;
  action: 'buy' | 'sell';
  type: HoldingType;
  ticker: string;
  name: string;
  units: number;
  unitType?: HoldingUnitType;
  priceMinor: bigint;
  feesMinor: bigint;
  location?: string;
}

interface RecordTradeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (trade: AddedTrade) => void;
}

export const INVESTMENT_CATEGORIES: {
  id: HoldingType;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  defaultTicker: string;
  namePlaceholder: string;
  unitLabel: string;
  unitPlaceholder: string;
  priceLabel: string;
  showTicker: boolean;
  defaultUnitType: HoldingUnitType;
}[] = [
  {
    id: 'stock',
    label: 'Stocks & Equities',
    icon: TrendingUp,
    defaultTicker: 'STOCK',
    namePlaceholder: 'e.g. MTN Nigeria Plc, Apple Inc',
    unitLabel: 'Number of Shares',
    unitPlaceholder: 'e.g. 500',
    priceLabel: 'Price per Share',
    showTicker: true,
    defaultUnitType: 'shares',
  },
  {
    id: 'realEstate',
    label: 'Real Estate & Land',
    icon: Building2,
    defaultTicker: 'PROP',
    namePlaceholder: 'e.g. 2 Plots at Epe, 3-Bed Lekki',
    unitLabel: 'Plots / Units Held',
    unitPlaceholder: 'e.g. 2',
    priceLabel: 'Price per Plot / Unit',
    showTicker: false,
    defaultUnitType: 'plots',
  },
  {
    id: 'fixedDeposit',
    label: 'Fixed Income & T-Bills',
    icon: Landmark,
    defaultTicker: 'TBILL',
    namePlaceholder: 'e.g. 364-Day FGN Treasury Bill, GTCO FD',
    unitLabel: 'Tenor or Lots',
    unitPlaceholder: 'e.g. 1',
    priceLabel: 'Principal Invested',
    showTicker: false,
    defaultUnitType: 'lumpSum',
  },
  {
    id: 'fund',
    label: 'Mutual Funds & ETFs',
    icon: PieChart,
    defaultTicker: 'FUND',
    namePlaceholder: 'e.g. Stanbic Money Market, VOO ETF',
    unitLabel: 'Number of Units',
    unitPlaceholder: 'e.g. 250',
    priceLabel: 'NAV / Unit Price',
    showTicker: true,
    defaultUnitType: 'units',
  },
  {
    id: 'crypto',
    label: 'Crypto & Digital Assets',
    icon: Coins,
    defaultTicker: 'BTC',
    namePlaceholder: 'e.g. Bitcoin, Ethereum',
    unitLabel: 'Number of Coins / Tokens',
    unitPlaceholder: 'e.g. 0.05',
    priceLabel: 'Price per Coin',
    showTicker: true,
    defaultUnitType: 'units',
  },
  {
    id: 'preciousMetals',
    label: 'Precious Metals',
    icon: Shield,
    defaultTicker: 'GOLD',
    namePlaceholder: 'e.g. 24k Gold Bullion Bar',
    unitLabel: 'Grams / Ounces',
    unitPlaceholder: 'e.g. 10',
    priceLabel: 'Price per Gram / Oz',
    showTicker: false,
    defaultUnitType: 'grams',
  },
  {
    id: 'privateEquity',
    label: 'Business & Ventures',
    icon: Briefcase,
    defaultTicker: 'VENTURE',
    namePlaceholder: 'e.g. Agro-Allied Farm Enterprise',
    unitLabel: 'Equity / Ownership Units',
    unitPlaceholder: 'e.g. 1',
    priceLabel: 'Capital Investment',
    showTicker: false,
    defaultUnitType: 'lumpSum',
  },
  {
    id: 'pension',
    label: 'Retirement & Pension',
    icon: Shield,
    defaultTicker: 'RSA',
    namePlaceholder: 'e.g. Stanbic RSA Pension Fund',
    unitLabel: 'Units Held',
    unitPlaceholder: 'e.g. 1000',
    priceLabel: 'Unit Price / NAV',
    showTicker: false,
    defaultUnitType: 'units',
  },
];

export function RecordTradeSheet({
  visible,
  onClose,
  onSave,
}: RecordTradeSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [category, setCategory] = useState<HoldingType>('stock');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [priceText, setPriceText] = useState('');
  const [feesText, setFeesText] = useState('0');
  const [location, setLocation] = useState('');
  const [unitType, setUnitType] = useState<HoldingUnitType>('shares');
  const [error, setError] = useState('');

  const activeCategory =
    INVESTMENT_CATEGORIES.find((c) => c.id === category) ??
    INVESTMENT_CATEGORIES[0]!;

  const handleCategorySelect = (newCat: HoldingType) => {
    setCategory(newCat);
    const catConfig =
      INVESTMENT_CATEGORIES.find((c) => c.id === newCat) ??
      INVESTMENT_CATEGORIES[0]!;
    setUnitType(catConfig.defaultUnitType);
    if (!catConfig.showTicker) {
      setTicker(catConfig.defaultTicker);
    } else {
      setTicker('');
    }
  };

  const handleSave = () => {
    const finalName = name.trim();
    if (!finalName && !ticker.trim()) {
      setError('Investment name or symbol is required');
      return;
    }
    const numUnits = parseFloat(units);
    if (!numUnits || numUnits <= 0) {
      setError('Please enter a valid quantity / unit amount');
      return;
    }
    const parsedPrice = parseAmount(priceText);
    if (!parsedPrice.ok || parsedPrice.minor <= 0n) {
      setError('Please enter a valid price / valuation amount');
      return;
    }
    const parsedFees = parseAmount(feesText);

    const finalTicker = activeCategory.showTicker
      ? ticker.trim().toUpperCase() || activeCategory.defaultTicker
      : ticker.trim().toUpperCase() || activeCategory.defaultTicker;

    onSave({
      id: `trade-${Date.now()}`,
      action,
      type: category,
      ticker: finalTicker,
      name: finalName || finalTicker,
      units: numUnits,
      unitType,
      priceMinor: parsedPrice.minor,
      feesMinor: parsedFees.ok ? parsedFees.minor : 0n,
      location: location.trim() || undefined,
    });

    setTicker('');
    setName('');
    setUnits('');
    setPriceText('');
    setFeesText('0');
    setLocation('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Record Investment / Asset">
      <View style={styles.container}>
        {/* Buy vs Sell Action Toggle */}
        <View
          style={[
            styles.actionRow,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.md,
              padding: 3,
              marginBottom: spacing.md,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setAction('buy')}
            style={[
              {
                backgroundColor: action === 'buy' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                paddingVertical: 7,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: action === 'buy' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.xs,
              }}
            >
              Acquire / Buy Asset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAction('sell')}
            style={[
              {
                backgroundColor: action === 'sell' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                paddingVertical: 7,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: action === 'sell' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.xs,
              }}
            >
              Liquidate / Sell Asset
            </Text>
          </TouchableOpacity>
        </View>

        {/* Investment Asset Class Selector */}
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: spacing.xs,
          }}
        >
          Select Asset Class
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md }}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {INVESTMENT_CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            const IconComponent = cat.icon;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => handleCategorySelect(cat.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                  borderColor: isSelected ? colors.primary : colors.borderSubtle,
                  borderWidth: isSelected ? 2 : 1,
                  borderRadius: radii.full,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  gap: 6,
                }}
              >
                <IconComponent
                  size={14}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={{
                    color: isSelected ? colors.primary : colors.textPrimary,
                    fontFamily: isSelected
                      ? typography.fonts.semiBold
                      : typography.fonts.medium,
                    fontSize: 12,
                  }}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Dynamic Fields based on Selected Asset Class */}
        {activeCategory.showTicker && (
          <View style={{ marginBottom: spacing.sm }}>
            <TextInput
              label="Ticker or Symbol"
              placeholder="e.g. MTNN, GTCO, VOO, BTC"
              value={ticker}
              onChangeText={(t) => {
                setTicker(t);
                if (error) setError('');
              }}
              error={error && !ticker.trim() ? error : undefined}
            />
          </View>
        )}

        <View style={{ marginBottom: spacing.sm }}>
          <TextInput
            label="Investment / Asset Description"
            placeholder={activeCategory.namePlaceholder}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            error={error && !name.trim() ? error : undefined}
          />
        </View>

        {/* Real Estate Location */}
        {category === 'realEstate' && (
          <View style={{ marginBottom: spacing.sm }}>
            <TextInput
              label="Location / Jurisdiction (Optional)"
              placeholder="e.g. Epe, Lagos or Lekki Phase 1"
              value={location}
              onChangeText={setLocation}
            />
          </View>
        )}

        {/* Unit Type & Quantity */}
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput
            label={activeCategory.unitLabel}
            placeholder={activeCategory.unitPlaceholder}
            value={units}
            onChangeText={setUnits}
            keyboardType="numeric"
          />
        </View>

        {/* Price / Valuation */}
        <View style={{ marginBottom: spacing.sm }}>
          <CurrencyInput
            label={activeCategory.priceLabel}
            value={priceText}
            onChangeText={setPriceText}
          />
        </View>

        {/* Fees */}
        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label={
              category === 'realEstate'
                ? 'Survey / Deed / Legal Fees'
                : category === 'stock'
                ? 'Brokerage / SEC / CSCS Fees'
                : 'Transaction / Advisory Fees'
            }
            value={feesText}
            onChangeText={setFeesText}
          />
        </View>

        <Button
          label={`Save ${activeCategory.label} Trade`}
          onPress={handleSave}
          variant="primary"
          size="lg"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
  },
});
