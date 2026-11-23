import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Button } from '../../design';
import { parseAmount } from '../../money';

import { t as i18nT } from '../../i18n';
interface SpendFromGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  goalName: string;
  savedMinor: bigint;
  onSpend: (amountMinor: bigint, payee: string) => void;
}

export function SpendFromGoalSheet({
  visible,
  onClose,
  goalName,
  savedMinor,
  onSpend,
}: SpendFromGoalSheetProps) {
  const { spacing } = useTheme();

  const [amountText, setAmountText] = useState('');
  const [payee, setPayee] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!payee.trim()) {
      setError('Merchant or item description is required');
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }
    if (parsed.minor > savedMinor) {
      setError('Amount exceeds current goal balance');
      return;
    }

    onSpend(parsed.minor, payee.trim());
    setAmountText('');
    setPayee('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Spend from ${goalName}`}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={i18nT('ui.spendFromGoalSheet.whatAreYouBuying')}
            placeholder={i18nT('ui.spendFromGoalSheet.eGFlightTicketMac')}
            value={payee}
            onChangeText={(t) => {
              setPayee(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput
            label={i18nT('ui.spendFromGoalSheet.amountToSpend')}
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              if (error) setError('');
            }}
          />
        </View>

        <Button
          label={i18nT('ui.spendFromGoalSheet.confirmPurchase')}
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
