import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

import { t as i18nT } from '../../i18n';
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
    <BottomSheet visible={visible} onClose={onClose} title={i18nT('ui.addIncomeSheet.addIncomeStream')}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={i18nT('ui.addIncomeSheet.streamName')}
            placeholder={i18nT('ui.addIncomeSheet.eGPrimaryTechSalary')}
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
            label={i18nT('ui.addIncomeSheet.expectedMonthlyAmount')}
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
            {i18nT('ui.addIncomeSheet.incomeCalculationMode')}
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
                {i18nT('ui.addIncomeSheet.netTakeHome')}
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
                {i18nT('ui.addIncomeSheet.grossWithDeductions')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={i18nT('ui.addIncomeSheet.expectedPayDayOfMonth')}
            value={payDay}
            onChangeText={setPayDay}
            keyboardType="number-pad"
            placeholder="25"
          />
        </View>

        <Button
          label={i18nT('ui.addIncomeSheet.saveIncomeStream')}
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
