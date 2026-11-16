import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Dropdown, Button } from '../../design';
import { formatNaira } from '../../money';
import type { CategoryEnvelope } from './CategoryEnvelopeRow';

export interface MoveMoneySheetProps {
  visible: boolean;
  onClose: () => void;
  envelopes: CategoryEnvelope[];
  onConfirmMove: ((fromId: string, toId: string, amountMinor: bigint) => void) | (() => void);
}

export function MoveMoneySheet({
  visible,
  onClose,
  envelopes,
  onConfirmMove,
}: MoveMoneySheetProps) {
  const { spacing } = useTheme();

  const [fromId, setFromId] = useState(envelopes[0]?.id || '');
  const [toId, setToId] = useState(envelopes[1]?.id || '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (fromId === toId) {
      setError('Cannot move money to the same envelope');
      return;
    }
    setError('');
    const amountMinor = BigInt(Math.round(parsed * 100));
    (onConfirmMove as (fromId: string, toId: string, amountMinor: bigint) => void)(fromId, toId, amountMinor);
    setAmount('');
    onClose();
  };

  const envelopeDropdownOptions = envelopes.map((env) => ({
    label: env.name,
    value: env.id,
    subtitle: `Available: ${formatNaira(env.plannedMinor - env.spentMinor)}`,
  }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Move Money Between Envelopes"
      subtitle="Reallocate funds between budget envelopes"
    >
      <View style={styles.form}>
        {/* Amount Input */}
        <CurrencyInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            if (error) setError('');
          }}
          error={error}
          placeholder="0.00"
        />

        {/* From Envelope Dropdown */}
        <Dropdown
          label="Move From (Take money from)"
          value={fromId}
          options={envelopeDropdownOptions}
          onSelect={(id) => {
            setFromId(id);
            if (error) setError('');
          }}
          containerStyle={{ marginTop: spacing.md }}
        />

        {/* To Envelope Dropdown */}
        <Dropdown
          label="Move To (Add money to)"
          value={toId}
          options={envelopeDropdownOptions}
          onSelect={(id) => {
            setToId(id);
            if (error) setError('');
          }}
          containerStyle={{ marginTop: spacing.md }}
        />

        {/* Save Button */}
        <View style={{ marginTop: spacing.xl }}>
          <Button label="Confirm Move" onPress={handleSave} variant="primary" size="lg" />
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
