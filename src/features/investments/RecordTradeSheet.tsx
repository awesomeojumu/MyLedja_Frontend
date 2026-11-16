import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

export interface AddedTrade {
  id: string;
  action: 'buy' | 'sell';
  ticker: string;
  name: string;
  units: number;
  priceMinor: bigint;
  feesMinor: bigint;
}

interface RecordTradeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (trade: AddedTrade) => void;
}

export function RecordTradeSheet({
  visible,
  onClose,
  onSave,
}: RecordTradeSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [priceText, setPriceText] = useState('');
  const [feesText, setFeesText] = useState('0');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!ticker.trim()) {
      setError('Ticker symbol or name is required');
      return;
    }
    const numUnits = parseFloat(units);
    if (!numUnits || numUnits <= 0) {
      setError('Please enter a valid number of units');
      return;
    }
    const parsedPrice = parseAmount(priceText);
    if (!parsedPrice.ok || parsedPrice.minor <= 0n) {
      setError('Please enter a valid unit price');
      return;
    }
    const parsedFees = parseAmount(feesText);

    onSave({
      id: `trade-${Date.now()}`,
      action,
      ticker: ticker.trim().toUpperCase(),
      name: name.trim() || ticker.trim().toUpperCase(),
      units: numUnits,
      priceMinor: parsedPrice.minor,
      feesMinor: parsedFees.ok ? parsedFees.minor : 0n,
    });

    setTicker('');
    setName('');
    setUnits('');
    setPriceText('');
    setFeesText('0');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Record Investment Trade">
      <View style={styles.container}>
        {/* Buy vs Sell */}
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
              styles.actionBtn,
              {
                backgroundColor: action === 'buy' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                paddingVertical: 8,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: action === 'buy' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Buy Asset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAction('sell')}
            style={[
              styles.actionBtn,
              {
                backgroundColor: action === 'sell' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                paddingVertical: 8,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: action === 'sell' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Sell Asset
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Asset Ticker or Symbol"
            placeholder="e.g. MTNN, GTCO, VOO, BTC"
            value={ticker}
            onChangeText={(t) => {
              setTicker(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Asset Description / Name"
            placeholder="e.g. MTN Nigeria Communications Plc"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Number of Units / Shares"
            placeholder="e.g. 500 or 1.25"
            value={units}
            onChangeText={setUnits}
            keyboardType="numeric"
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label="Price per Unit"
            value={priceText}
            onChangeText={setPriceText}
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput
            label="Brokerage / SEC Fees"
            value={feesText}
            onChangeText={setFeesText}
          />
        </View>

        <Button
          label="Save Trade Entry"
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
  actionBtn: {},
});
