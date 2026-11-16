import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Dropdown, Button } from '../../design';

export interface QuickTransferSheetProps {
  visible: boolean;
  onClose: () => void;
  onTransfer: (data: { fromAccount: string; toAccount: string; amount: string }) => void;
}

const ACCOUNTS = ['GTBank (Current)', 'Kuda Bank', 'Cash Wallet'];

export function QuickTransferSheet({
  visible,
  onClose,
  onTransfer,
}: QuickTransferSheetProps) {
  const { spacing } = useTheme();

  const [fromAccount, setFromAccount] = useState('GTBank (Current)');
  const [toAccount, setToAccount] = useState('Kuda Bank');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (fromAccount === toAccount) {
      setError('From and To accounts must be different');
      return;
    }
    setError('');
    onTransfer({
      fromAccount,
      toAccount,
      amount,
    });
    setAmount('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Transfer Money"
      subtitle="Moving money between your own accounts is not an expense"
    >
      <View style={styles.form}>
        <CurrencyInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            if (error) setError('');
          }}
          error={error}
          placeholder="0.00"
        />

        {/* From Account Dropdown */}
        <Dropdown
          label="From Account"
          value={fromAccount}
          options={ACCOUNTS}
          onSelect={(acc) => {
            setFromAccount(acc);
            if (error) setError('');
          }}
          containerStyle={{ marginTop: spacing.md }}
        />

        {/* To Account Dropdown */}
        <Dropdown
          label="To Account"
          value={toAccount}
          options={ACCOUNTS}
          onSelect={(acc) => {
            setToAccount(acc);
            if (error) setError('');
          }}
          containerStyle={{ marginTop: spacing.md }}
        />

        {/* Confirm Button */}
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label="Confirm Transfer"
            onPress={handleConfirm}
            variant="primary"
            size="lg"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
  },
});
