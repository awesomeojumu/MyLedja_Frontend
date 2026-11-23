import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

import { t as i18nT } from '../../i18n';
interface RecordDividendSheetProps {
  visible: boolean;
  onClose: () => void;
  ticker: string;
  onSaveDividend: (amountMinor: bigint) => void;
}

export function RecordDividendSheet({
  visible,
  onClose,
  ticker,
  onSaveDividend,
}: RecordDividendSheetProps) {
  const { spacing } = useTheme();

  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid dividend amount');
      return;
    }
    onSaveDividend(parsed.minor);
    setAmountText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Record Dividend for ${ticker}`}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput
            label={i18nT('ui.recordDividendSheet.netDividendReceived')}
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <Button
          label={i18nT('ui.recordDividendSheet.saveDividendInflow')}
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
});
