import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

export interface AddedBill {
  id: string;
  name: string;
  amountMinor: bigint;
  dueDay: number;
  cadence: 'monthly' | 'quarterly' | 'annual';
  category: string;
}

interface AddBillSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (bill: AddedBill) => void;
}

export function AddBillSheet({
  visible,
  onClose,
  onSave,
}: AddBillSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [cadence, setCadence] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [category, setCategory] = useState('Utilities');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Bill name is required');
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }

    onSave({
      id: `bill-${Date.now()}`,
      name: name.trim(),
      amountMinor: parsed.minor,
      dueDay: parseInt(dueDay, 10) || 1,
      cadence,
      category: category.trim() || 'Utilities',
    });
    setName('');
    setAmountText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Recurring Bill">
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Bill or Subscription Name"
            placeholder="e.g. Fiber Internet, DSTV, Electricity"
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
            label="Scheduled Amount"
            value={amountText}
            onChangeText={setAmountText}
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Due Day of Month"
            value={dueDay}
            onChangeText={setDueDay}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>

        {/* Cadence Buttons */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              marginBottom: spacing.xs,
            }}
          >
            Billing Frequency
          </Text>
          <View
            style={[
              styles.cadenceRow,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.md,
                padding: 3,
              },
            ]}
          >
            {(['monthly', 'quarterly', 'annual'] as const).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCadence(c)}
                style={[
                  styles.cadenceBtn,
                  {
                    backgroundColor: cadence === c ? colors.surface : 'transparent',
                    borderRadius: radii.sm,
                    paddingVertical: 8,
                    flex: 1,
                    alignItems: 'center',
                  },
                ]}
              >
                <Text
                  style={{
                    color: cadence === c ? colors.primary : colors.textSecondary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.xs,
                    textTransform: 'capitalize',
                  }}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          label="Save Recurring Bill"
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
  cadenceRow: {
    flexDirection: 'row',
  },
  cadenceBtn: {},
});
