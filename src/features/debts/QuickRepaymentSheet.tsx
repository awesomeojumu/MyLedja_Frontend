import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

import { t as i18nT } from '../../i18n';
interface QuickRepaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  debtPerson: string;
  remainingMinor: bigint;
  type: 'lent' | 'borrowed';
  onRecordRepayment: (amountMinor: bigint) => void;
}

export function QuickRepaymentSheet({
  visible,
  onClose,
  debtPerson,
  remainingMinor,
  type,
  onRecordRepayment,
}: QuickRepaymentSheetProps) {
  const { spacing } = useTheme();

  const [amountText, setAmountText] = useState(
    remainingMinor > 0n ? (Number(remainingMinor) / 100).toString() : ''
  );
  const [error, setError] = useState('');

  const handleSave = () => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }
    onRecordRepayment(parsed.minor);
    onClose();
  };

  const title =
    type === 'lent'
      ? `Record Money Received from ${debtPerson}`
      : `Record Repayment to ${debtPerson}`;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput
            label={i18nT('ui.quickRepaymentSheet.paymentAmount')}
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <Button
          label={i18nT('ui.quickRepaymentSheet.recordPayment')}
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
