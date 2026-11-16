import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

export interface AddedGoal {
  id: string;
  name: string;
  targetMinor: bigint;
  targetDate?: string;
}

interface CreateGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goal: AddedGoal) => void;
}

export function CreateGoalSheet({
  visible,
  onClose,
  onSave,
}: CreateGoalSheetProps) {
  const { spacing } = useTheme();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Goal name is required');
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid target amount');
      return;
    }

    onSave({
      id: `goal-${Date.now()}`,
      name: name.trim(),
      targetMinor: parsed.minor,
      targetDate: targetDate.trim(),
    });
    setName('');
    setAmountText('');
    setTargetDate('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Create Savings Goal">
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Goal Name"
            placeholder="e.g. New Mac M4, December Detty December, House Rent"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label="Target Amount"
            value={amountText}
            onChangeText={setAmountText}
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label="Target Date (Optional)"
            placeholder="e.g. 15 Dec 2026"
            value={targetDate}
            onChangeText={setTargetDate}
          />
        </View>

        <Button
          label="Create Goal"
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
