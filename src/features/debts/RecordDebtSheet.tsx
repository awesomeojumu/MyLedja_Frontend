import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button, DatePicker } from '../../design';
import { parseAmount } from '../../money';

export interface AddedDebt {
  id: string;
  type: 'lent' | 'borrowed';
  person: string;
  amountMinor: bigint;
  notes?: string;
  dueDate?: string;
}

interface RecordDebtSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (debt: AddedDebt) => void;
}

export function RecordDebtSheet({
  visible,
  onClose,
  onSave,
}: RecordDebtSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [person, setPerson] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!person.trim()) {
      setError('Counterparty name is required');
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }

    onSave({
      id: `debt-${Date.now()}`,
      type,
      person: person.trim(),
      amountMinor: parsed.minor,
      dueDate: dueDate.trim(),
      notes: notes.trim(),
    });

    setPerson('');
    setAmountText('');
    setDueDate('');
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={type === 'lent' ? 'Record Money Lent' : 'Record Money Borrowed'}
    >
      <View style={styles.container}>
        {/* Toggle Type */}
        <View
          style={[
            styles.typeToggle,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.md,
              padding: 3,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setType('lent')}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: type === 'lent' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                paddingVertical: 5,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: type === 'lent' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              I Lent Money (Receivable)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setType('borrowed')}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: type === 'borrowed' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                paddingVertical: 5,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: type === 'borrowed' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              I Borrowed Money (Payable)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: spacing.sm }}>
          <TextInput
            label={type === 'lent' ? 'Borrower Name / Who took it?' : 'Lender Name / Who lent you?'}
            placeholder="e.g. Tunde Alabi, Stanbic Quick Loan"
            value={person}
            onChangeText={(t) => {
              setPerson(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.sm }}>
          <CurrencyInput
            label="Total Principal Amount"
            value={amountText}
            onChangeText={setAmountText}
          />
        </View>

        <View style={{ marginBottom: spacing.sm, zIndex: 20 }}>
          <DatePicker
            label="Expected Repayment Date (Optional)"
            placeholder="Select repayment date..."
            value={dueDate}
            onChange={setDueDate}
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Notes (Optional)"
            placeholder="e.g. Urgent car repair loan, interest-free"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <Button
          label="Save Debt Record"
          onPress={handleSave}
          variant="primary"
          size="md"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
  },
  typeToggle: {
    flexDirection: 'row',
  },
  toggleBtn: {},
});
