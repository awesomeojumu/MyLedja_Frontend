import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, BottomSheet } from '../../design';
import { useCategoryChoices } from '../categories/catalog';
import { t } from '../../i18n';

export interface BulkEditSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedCount: number;
  /** The workspace category id and its name. */
  onSelectCategory: (categoryId: string, name: string) => void;
}


export function BulkEditSheet({
  visible,
  onClose,
  selectedCount,
  onSelectCategory,
}: BulkEditSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const expense = useCategoryChoices('expense');
  const income = useCategoryChoices('income');
  const categories = [...expense, ...income];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('bulk.title')}
      subtitle={t('bulk.subtitle', { n: selectedCount })}
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
          {t('bulk.instruction')}
        </Text>

        <View style={styles.list}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => {
                onSelectCategory(cat.id, cat.name);
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
                {cat.name}
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
