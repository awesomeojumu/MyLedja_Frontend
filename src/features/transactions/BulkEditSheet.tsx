import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, BottomSheet } from '../../design';

export interface BulkEditSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedCount: number;
  onSelectCategory: (category: string) => void;
}

const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation & Fuel',
  'Utilities & Bills',
  'Shopping',
  'Healthcare',
  'Entertainment',
  'Salary / Income',
  'Transfers',
];

export function BulkEditSheet({
  visible,
  onClose,
  selectedCount,
  onSelectCategory,
}: BulkEditSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Categorize Transactions"
      subtitle={`Choose a category for ${selectedCount} selected transactions`}
    >
      <View style={styles.container}>
        <Text
          style={[
            styles.instruction,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.sm,
              marginBottom: spacing.md,
            },
          ]}
        >
          Tap any category below to immediately update all selected entries:
        </Text>

        <View style={styles.list}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                onSelectCategory(cat);
                onClose();
              }}
              activeOpacity={0.7}
              style={[
                styles.catPill,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  marginBottom: spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  styles.catText,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  instruction: {},
  list: {
    flexDirection: 'column',
  },
  catPill: {
    borderWidth: 1,
  },
  catText: {},
});
