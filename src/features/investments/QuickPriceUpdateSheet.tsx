import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';
import { formatNaira } from '../../money';

export interface PriceHoldingItem {
  id: string;
  ticker: string;
  currentPriceMinor: bigint;
}

interface QuickPriceUpdateSheetProps {
  visible: boolean;
  onClose: () => void;
  holdings: PriceHoldingItem[];
  onSavePrices: (updated: Record<string, string>) => void;
}

export function QuickPriceUpdateSheet({
  visible,
  onClose,
  holdings,
  onSavePrices,
}: QuickPriceUpdateSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const h of holdings) {
      init[h.id] = (Number(h.currentPriceMinor) / 100).toString();
    }
    return init;
  });

  const handleUpdate = (id: string, text: string) => {
    setPrices((prev) => ({ ...prev, [id]: text }));
  };

  const handleSave = () => {
    onSavePrices(prices);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Quick Update Market Prices">
      <View style={styles.container}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.bodySm,
            marginBottom: spacing.md,
          }}
        >
          Enter today's unit prices to recalculate current valuation and portfolio gain/loss.
        </Text>

        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {holdings.map((h) => (
            <View
              key={h.id}
              style={[
                styles.holdingRow,
                {
                  borderBottomColor: colors.borderSubtle,
                  paddingVertical: spacing.sm,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
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
                  }}
                >
                  Last: {formatNaira(h.currentPriceMinor)}
                </Text>
              </View>

              <View style={{ width: 140 }}>
                <TextInput
                  value={prices[h.id] ?? ''}
                  onChangeText={(t) => handleUpdate(h.id, t)}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Save All Prices"
            onPress={handleSave}
            variant="primary"
            size="lg"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
