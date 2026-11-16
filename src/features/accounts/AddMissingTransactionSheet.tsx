import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

interface AddMissingTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (tx: { payee: string; amountMinor: bigint; type: 'inflow' | 'outflow' }) => void;
}

export function AddMissingTransactionSheet({
  visible,
  onClose,
  onAdd,
}: AddMissingTransactionSheetProps) {
  const { spacing } = useTheme();

  const [payee, setPayee] = useState('');
  const [amountText, setAmountText] = useState('');
  const [isDeposit, setIsDeposit] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!payee.trim()) {
      setError('Description is required');
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }

    onAdd({
      payee: payee.trim(),
      amountMinor: parsed.minor,
      type: isDeposit ? 'inflow' : 'outflow',
    });
    setPayee('');
    setAmountText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Missing Transaction">
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Description / Narration"
            value={payee}
            onChangeText={(t) => {
              setPayee(t);
              if (error) setError('');
            }}
            placeholder="e.g. Bank SMS charge, POS Fee"
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput
            label="Amount"
            value={amountText}
            onChangeText={setAmountText}
          />
        </View>

        <Button
          label="Add & Mark Cleared"
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
