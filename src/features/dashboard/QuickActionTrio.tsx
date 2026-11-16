import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Plus, ArrowDownLeft, ArrowLeftRight } from 'lucide-react-native';
import { useTheme, Button } from '../../design';

export interface QuickActionTrioProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
  onTransfer: () => void;
}

export function QuickActionTrio({ onAddExpense, onAddIncome, onTransfer }: QuickActionTrioProps) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.container, { marginVertical: spacing.lg }]}>
      <View style={styles.buttonWrapper}>
        <Button
          label="Add Expense"
          onPress={onAddExpense}
          variant="primary"
          icon={<Plus size={16} color="#FFFFFF" />}
        />
      </View>

      <View style={styles.buttonWrapper}>
        <Button
          label="Add Income"
          onPress={onAddIncome}
          variant="secondary"
          icon={<ArrowDownLeft size={16} color="#2563EB" />}
        />
      </View>

      <View style={styles.buttonWrapper}>
        <Button
          label="Transfer"
          onPress={onTransfer}
          variant="secondary"
          icon={<ArrowLeftRight size={16} color="#64748B" />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  buttonWrapper: {
    flex: 1,
  },
});
