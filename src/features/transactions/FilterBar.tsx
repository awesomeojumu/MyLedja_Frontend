import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Search, SlidersHorizontal, Download, CheckSquare } from 'lucide-react-native';
import { useTheme, TextInput } from '../../design';

export type FilterPreset = 'all' | 'expense' | 'income' | 'transfers' | 'uncategorized';

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activePreset: FilterPreset;
  onSelectPreset: (preset: FilterPreset) => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onOpenFilterDrawer: () => void;
  onOpenExport: () => void;
}

const PRESET_TABS: { id: FilterPreset; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'uncategorized', label: 'Uncategorized' },
];

export function FilterBar({
  searchQuery,
  onSearchChange,
  activePreset,
  onSelectPreset,
  isSelectionMode,
  onToggleSelectionMode,
  onOpenFilterDrawer,
  onOpenExport,
}: FilterBarProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <View style={[styles.container, { marginBottom: spacing.md }]}>
      {/* Search Input */}
      <TextInput
        placeholder="Search payee, category, note..."
        value={searchQuery}
        onChangeText={onSearchChange}
        leftElement={<Search size={18} color={colors.textTertiary} />}
      />

      {/* Preset Pills and Action Icons */}
      <View style={[styles.controlsRow, { marginTop: spacing.sm }]}>
        {/* Quick Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, alignItems: 'center' }}
          style={{ flex: 1, marginRight: spacing.sm }}
        >
          {PRESET_TABS.map((tab) => {
            const isSelected = activePreset === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => onSelectPreset(tab.id)}
                activeOpacity={0.7}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                    borderColor: isSelected ? colors.primary : colors.borderSubtle,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs + 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.primary : colors.textSecondary,
                      fontFamily: isSelected ? typography.fonts.semiBold : typography.fonts.medium,
                      fontSize: typography.sizes.xs + 1,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Action Icons: Filter, Import/Export, Check Multi-select */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Filter parameters"
            onPress={onOpenFilterDrawer}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
                borderRadius: radii.md,
                marginRight: spacing.xs,
              },
            ]}
          >
            <SlidersHorizontal size={16} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Export or Import CSV"
            onPress={onOpenExport}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
                borderRadius: radii.md,
                marginRight: spacing.xs,
              },
            ]}
          >
            <Download size={16} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Multi-select mode"
            onPress={onToggleSelectionMode}
            style={[
              styles.iconBtn,
              {
                backgroundColor: isSelectionMode ? colors.primaryLight : colors.surfaceSubtle,
                borderColor: isSelectionMode ? colors.primary : colors.border,
                borderRadius: radii.md,
              },
            ]}
          >
            <CheckSquare size={16} color={isSelectionMode ? colors.primary : colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetChip: {
    borderWidth: 1,
  },
  chipText: {
    userSelect: 'none',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
