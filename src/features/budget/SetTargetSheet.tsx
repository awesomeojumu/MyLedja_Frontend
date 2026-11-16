import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Button } from '../../design';
import { parseAmount } from '../../money';

interface SetTargetSheetProps {
  visible: boolean;
  onClose: () => void;
  categoryName: string;
  initialTargetMinor?: bigint;
  onSaveTarget: (targetMinor: bigint, dueDay?: number) => void;
}

export function SetTargetSheet({
  visible,
  onClose,
  categoryName,
  initialTargetMinor = 0n,
  onSaveTarget,
}: SetTargetSheetProps) {
  const { spacing } = useTheme();

  const [amountText, setAmountText] = useState(
    initialTargetMinor > 0n ? (Number(initialTargetMinor) / 100).toString() : ''
  );
  const [dueDay, setDueDay] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor < 0n) {
      setError('Please enter a valid target amount');
      return;
    }
    const day = dueDay ? parseInt(dueDay, 10) : undefined;
    onSaveTarget(parsed.minor, day);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Set Target for ${categoryName}`}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label="Monthly Spending Target"
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
            label="Target Due Day of Month (Optional)"
            placeholder="e.g. 25 (e.g. rent or utility deadline)"
            value={dueDay}
            onChangeText={setDueDay}
            keyboardType="number-pad"
          />
        </View>

        <Button
          label="Save Target"
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
