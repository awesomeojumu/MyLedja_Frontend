import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

export interface AddedIncomeStream {
  id: string;
  name: string;
  expectedMinor: bigint;
  mode: 'net' | 'gross';
  payDay: number;
}

interface AddIncomeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (stream: AddedIncomeStream) => void;
}

export function AddIncomeSheet({
  visible,
  onClose,
  onSave,
}: AddIncomeSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [mode, setMode] = useState<'net' | 'gross'>('net');
  const [payDay, setPayDay] = useState('25');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Stream name is required');
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }

    onSave({
      id: `str-${Date.now()}`,
      name: name.trim(),
      expectedMinor: parsed.minor,
      mode,
      payDay: parseInt(payDay, 10) || 25,
    });
    setName('');
    setAmountText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Income Stream">
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Stream Name"
            placeholder="e.g. Primary Tech Salary, Consulting Client"
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
            label="Expected Monthly Amount"
            value={amountText}
            onChangeText={setAmountText}
          />
        </View>

        {/* Mode Toggle: Net vs Gross */}
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              marginBottom: spacing.xs,
            }}
          >
            Income Calculation Mode
          </Text>
          <View
            style={[
              styles.modeRow,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.md,
                padding: 3,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setMode('net')}
              style={[
                styles.modeBtn,
                {
                  backgroundColor: mode === 'net' ? colors.surface : 'transparent',
                  borderRadius: radii.sm,
                  paddingVertical: 8,
                  flex: 1,
                  alignItems: 'center',
                },
              ]}
            >
              <Text
                style={{
                  color: mode === 'net' ? colors.primary : colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                }}
              >
                Net Take-Home
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('gross')}
              style={[
                styles.modeBtn,
                {
                  backgroundColor: mode === 'gross' ? colors.surface : 'transparent',
                  borderRadius: radii.sm,
                  paddingVertical: 8,
                  flex: 1,
                  alignItems: 'center',
                },
              ]}
            >
              <Text
                style={{
                  color: mode === 'gross' ? colors.primary : colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                }}
              >
                Gross (With Deductions)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label="Expected Pay Day of Month"
            value={payDay}
            onChangeText={setPayDay}
            keyboardType="number-pad"
            placeholder="25"
          />
        </View>

        <Button
          label="Save Income Stream"
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
  modeRow: {
    flexDirection: 'row',
  },
  modeBtn: {},
});
