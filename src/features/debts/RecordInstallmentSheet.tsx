import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Button } from '../../design';
import { parseAmount } from '../../money';

import { t as i18nT } from '../../i18n';
interface RecordInstallmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onAddInstallment: (installment: { amountMinor: bigint; note: string }) => void;
}

export function RecordInstallmentSheet({
  visible,
  onClose,
  onAddInstallment,
}: RecordInstallmentSheetProps) {
  const { spacing } = useTheme();

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }
    onAddInstallment({
      amountMinor: parsed.minor,
      note: note.trim() || 'Installment Payment',
    });
    setAmountText('');
    setNote('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={i18nT('ui.recordInstallmentSheet.recordPaymentInstallment')}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label={i18nT('ui.recordInstallmentSheet.paymentAmount')}
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={i18nT('ui.recordInstallmentSheet.paymentNoteOptional')}
            placeholder={i18nT('ui.recordInstallmentSheet.eGBankTransferReference')}
            value={note}
            onChangeText={setNote}
          />
        </View>

        <Button
          label={i18nT('ui.recordInstallmentSheet.savePayment')}
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
