import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

export interface FilterOptions {
  dateRange: 'all' | 'this-month' | 'last-30' | 'this-year';
  account: string;
  type: 'all' | 'expense' | 'income' | 'transfer';
}

export interface FilterDrawerSheetProps {
  visible: boolean;
  onClose: () => void;
  currentFilters: FilterOptions;
  onApplyFilters: (filters: FilterOptions) => void;
}

const DATE_RANGES: { id: FilterOptions['dateRange']; label: string }[] = [
  { id: 'all', label: 'All Time' },
  { id: 'this-month', label: 'This Month' },
  { id: 'last-30', label: 'Last 30 Days' },
  { id: 'this-year', label: 'This Year' },
];

const ALL_ACCOUNTS = 'All Accounts';

const TYPES: { id: FilterOptions['type']; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'expense', label: 'Expenses Only' },
  { id: 'income', label: 'Income Only' },
  { id: 'transfer', label: 'Transfers Only' },
];

export function FilterDrawerSheet({
  visible,
  onClose,
  currentFilters,
  onApplyFilters,
}: FilterDrawerSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [dateRange, setDateRange] = useState(currentFilters.dateRange);
  const { accounts: dbAccounts } = useDatabaseData();
  const ACCOUNTS = [ALL_ACCOUNTS, ...dbAccounts.filter((a) => !a.archived).map((a) => a.name)];
  const [account, setAccount] = useState(currentFilters.account);
  const [type, setType] = useState(currentFilters.type);

  const handleApply = () => {
    onApplyFilters({ dateRange, account, type });
    onClose();
  };

  const handleReset = () => {
    setDateRange('all');
    setAccount('All Accounts');
    setType('all');
    onApplyFilters({ dateRange: 'all', account: ALL_ACCOUNTS, type: 'all' });
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Ledger"
      subtitle="Refine transactions displayed in your ledger"
    >
      <View style={styles.container}>
        {/* Date Range */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.sm, marginBottom: spacing.xs }]}>
            Date Range
          </Text>
          <View style={styles.chipRow}>
            {DATE_RANGES.map((d) => {
              const isSelected = dateRange === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setDateRange(d.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      marginRight: spacing.xs,
                      marginBottom: spacing.xs,
                    },
                  ]}
                >
                  <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.sm }}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Account Filter */}
        <View style={[styles.section, { marginTop: spacing.md }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.sm, marginBottom: spacing.xs }]}>
            Account
          </Text>
          <View style={styles.chipRow}>
            {ACCOUNTS.map((acc) => {
              const isSelected = account === acc;
              return (
                <TouchableOpacity
                  key={acc}
                  onPress={() => setAccount(acc)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      marginRight: spacing.xs,
                      marginBottom: spacing.xs,
                    },
                  ]}
                >
                  <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.sm }}>
                    {acc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Type Filter */}
        <View style={[styles.section, { marginTop: spacing.md }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.sm, marginBottom: spacing.xs }]}>
            Transaction Type
          </Text>
          <View style={styles.chipRow}>
            {TYPES.map((t) => {
              const isSelected = type === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setType(t.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      marginRight: spacing.xs,
                      marginBottom: spacing.xs,
                    },
                  ]}
                >
                  <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.sm }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Buttons */}
        <View style={{ marginTop: spacing.xl, gap: 8 }}>
          <Button label="Apply Filters" onPress={handleApply} variant="primary" />
          <Button label="Reset to Default" onPress={handleReset} variant="secondary" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  section: {},
  sectionTitle: {},
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1 },
});
