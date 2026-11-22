import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import {
  TrendingUp,
  Building2,
  Landmark,
  PieChart,
  Coins,
  Shield,
  Briefcase,
} from 'lucide-react-native';
import {
  useTheme,
  BottomSheet,
  TextInput,
  CurrencyInput,
  Button,
  Dropdown,
  type DropdownOption,
} from '../../design';
import { parseAmount } from '../../money';
import { t } from '../../i18n';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { isSpendingAccount } from '../accounts/purpose';
import { pickAccount } from '../accounts/pickAccount';
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
  holdingId?: string;
  /** The everyday account the money comes from (buy) or goes into (sell). */
  cashAccountId: string;
}

export interface ExistingHoldingOption {
  id: string;
  ticker: string;
  name: string;
  units: number;
  type: HoldingType;
  unitType?: HoldingUnitType;
}

interface RecordTradeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (trade: AddedTrade) => void;
  existingHoldings?: ExistingHoldingOption[];
}

export const INVESTMENT_CATEGORIES: {
  id: HoldingType;
  label: string;
  subtitle: string;
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
    subtitle: 'NGX & Global public equities, shares',
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
    subtitle: 'Land plots, residential & commercial property',
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
    subtitle: 'Treasury bills, fixed deposits, sovereign bonds',
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
    subtitle: 'Money market funds, index ETFs, balanced funds',
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
    subtitle: 'Bitcoin, Ethereum, digital tokens',
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
    subtitle: 'Physical gold bullion, silver, commodities',
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
    subtitle: 'SME equity, startup investments, syndicates',
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
    subtitle: 'RSA pension fund allocations',
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
  existingHoldings = [],
}: RecordTradeSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [category, setCategory] = useState<HoldingType>('stock');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('');
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [priceText, setPriceText] = useState('');
  const [feesText, setFeesText] = useState('0');
  const [location, setLocation] = useState('');
  const [unitType, setUnitType] = useState<HoldingUnitType>('shares');
  const [error, setError] = useState('');
  const { accounts } = useDatabaseData();
  const cashAccounts = accounts.filter(isSpendingAccount);
  const [cashAccountId, setCashAccountId] = useState('');
  const cashId = cashAccounts.some((a) => a.id === cashAccountId) ? cashAccountId : (pickAccount(accounts)?.id ?? '');

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

  const handleSelectExisting = (holdingId: string) => {
    setSelectedHoldingId(holdingId);
    const found = existingHoldings.find((h) => h.id === holdingId);
    if (found) {
      setName(found.name);
      setTicker(found.ticker);
      setCategory(found.type);
      if (found.unitType) setUnitType(found.unitType);
      setUnits(String(found.units));
    }
  };

  const dropdownOptions: DropdownOption[] = INVESTMENT_CATEGORIES.map((cat) => {
    const IconComp = cat.icon;
    return {
      label: cat.label,
      value: cat.id,
      subtitle: cat.subtitle,
      icon: <IconComp size={16} color={colors.primary} />,
    };
  });

  const handleSave = () => {
    const finalName = name.trim();
    if (!finalName && !ticker.trim()) {
      setError('Investment name or symbol is required');
      return;
    }
    const numUnits = Number(units.replace(/,/g, ''));
    if (!Number.isFinite(numUnits) || numUnits <= 0) {
      setError('Please enter a valid quantity / unit amount');
      return;
    }
    const parsedPrice = parseAmount(priceText);
    if (!parsedPrice.ok || parsedPrice.minor <= 0n) {
      setError('Please enter a valid price / valuation amount');
      return;
    }
    const parsedFees = parseAmount(feesText);
    if (!cashId) {
      setError(t('invest.noCashAccount'));
      return;
    }

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
      holdingId: selectedHoldingId || undefined,
      cashAccountId: cashId,
    });

    setTicker('');
    setName('');
    setUnits('');
    setPriceText('');
    setFeesText('0');
    setLocation('');
    setSelectedHoldingId('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={action === 'sell' ? 'Liquidate / Sell Asset' : 'Record Investment'}
    >
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
            onPress={() => {
              setAction('buy');
              setSelectedHoldingId('');
            }}
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

        {/* When Selling, show Existing Holdings Dropdown if available */}
        {action === 'sell' && existingHoldings.length > 0 && (
          <View style={{ marginBottom: spacing.sm, zIndex: 20 }}>
            <Dropdown
              label="Select Existing Holding to Liquidate"
              value={selectedHoldingId}
              options={existingHoldings.map((h) => ({
                label: `${h.name} (${h.units} ${h.unitType || 'units'} held)`,
                value: h.id,
                subtitle: `${h.ticker} • ${h.type}`,
              }))}
              onSelect={handleSelectExisting}
            />
          </View>
        )}

        {/* Investment Asset Class Dropdown */}
        <View style={{ marginBottom: spacing.md, zIndex: 10 }}>
          <Dropdown
            label="Asset Class"
            value={category}
            options={dropdownOptions}
            onSelect={(val) => handleCategorySelect(val as HoldingType)}
          />
        </View>

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
            label={action === 'sell' ? `Units to Sell (${activeCategory.unitLabel})` : activeCategory.unitLabel}
            placeholder={activeCategory.unitPlaceholder}
            value={units}
            onChangeText={setUnits}
            keyboardType="numeric"
          />
        </View>

        {/* Price / Valuation */}
        <View style={{ marginBottom: spacing.sm }}>
          <CurrencyInput
            label={action === 'sell' ? 'Liquidation / Selling Price per Unit' : activeCategory.priceLabel}
            value={priceText}
            onChangeText={setPriceText}
          />
        </View>

        {/* Fees */}
        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label={
              action === 'sell'
                ? 'Exit / Brokerage / Settlement Fees'
                : category === 'realEstate'
                ? 'Survey / Deed / Legal Fees'
                : category === 'stock'
                ? 'Brokerage / SEC / CSCS Fees'
                : 'Transaction / Advisory Fees'
            }
            value={feesText}
            onChangeText={setFeesText}
          />
        </View>

        <Dropdown
          label={action === 'sell' ? t('invest.paidInto') : t('invest.paidFrom')}
          value={cashId}
          options={cashAccounts.map((a) => ({ label: a.name, value: a.id, subtitle: a.institution }))}
          onSelect={setCashAccountId}
          containerStyle={{ marginBottom: spacing.md }}
        />

        <Button
          label={
            action === 'sell'
              ? `Liquidate / Sell ${activeCategory.label}`
              : `Save ${activeCategory.label} Investment`
          }
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
