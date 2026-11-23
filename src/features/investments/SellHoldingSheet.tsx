import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount, formatNaira } from '../../money';

import { t as i18nT } from '../../i18n';
interface SellHoldingSheetProps {
  visible: boolean;
  onClose: () => void;
  ticker: string;
  availableUnits: number;
  avgCostMinor: bigint;
  onConfirmSale: (units: number, priceMinor: bigint) => void;
}

export function SellHoldingSheet({
  visible,
  onClose,
  ticker,
  availableUnits,
  avgCostMinor,
  onConfirmSale,
}: SellHoldingSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [unitsText, setUnitsText] = useState('');
  const [priceText, setPriceText] = useState('');
  const [error, setError] = useState('');

  const numUnits = Number(unitsText.replace(/,/g, '')) || 0;
  const parsedPrice = parseAmount(priceText);
  const priceMinor = parsedPrice.ok ? parsedPrice.minor : 0n;

  const totalProceedsMinor =
    (priceMinor * BigInt(Math.round(numUnits * 100))) / 100n;
  const totalCostMinor =
    (avgCostMinor * BigInt(Math.round(numUnits * 100))) / 100n;
  const capitalGainMinor = totalProceedsMinor - totalCostMinor;

  const handleSave = () => {
    if (numUnits <= 0 || numUnits > availableUnits) {
      setError(`Units must be between 1 and ${availableUnits}`);
      return;
    }
    if (priceMinor <= 0n) {
      setError('Please enter a valid sell price');
      return;
    }
    onConfirmSale(numUnits, priceMinor);
    setUnitsText('');
    setPriceText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Sell ${ticker} Shares`}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={`Number of Units to Sell (Max: ${availableUnits})`}
            placeholder={i18nT('ui.sellHoldingSheet.eG500')}
            value={unitsText}
            onChangeText={(t) => {
              setUnitsText(t);
              if (error) setError('');
            }}
            keyboardType="numeric"
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label={i18nT('ui.sellHoldingSheet.sellingPricePerShare')}
            value={priceText}
            onChangeText={setPriceText}
          />
        </View>

        {numUnits > 0 && priceMinor > 0n && (
          <View
            style={[
              styles.previewBox,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>
                {i18nT('ui.sellHoldingSheet.totalProceeds')}
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                }}
              >
                {formatNaira(totalProceedsMinor)}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: spacing.xs,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>
                {i18nT('ui.sellHoldingSheet.estCapitalGainLoss')}
              </Text>
              <Text
                style={{
                  color: capitalGainMinor >= 0n ? colors.statusSuccess : colors.statusDanger,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                }}
              >
                {capitalGainMinor >= 0n ? '+' : ''}
                {formatNaira(capitalGainMinor)}
              </Text>
            </View>
          </View>
        )}

        <Button
          label={i18nT('ui.sellHoldingSheet.confirmSale')}
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
  previewBox: {
    borderWidth: 1,
  },
});
