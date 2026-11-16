import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tag, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../design';

export interface FloatingBulkActionBarProps {
  selectedCount: number;
  onCategorize: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function FloatingBulkActionBar({
  selectedCount,
  onCategorize,
  onDelete,
  onCancel,
}: FloatingBulkActionBarProps) {
  const { colors, typography, spacing, radii } = useTheme();

  if (selectedCount === 0) return null;

  return (
    <View style={styles.floatingContainer}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: radii.full,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <Text
          style={[
            styles.countText,
            {
              color: colors.textPrimary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              marginRight: spacing.md,
            },
          ]}
        >
          {selectedCount} selected
        </Text>

        <TouchableOpacity
          onPress={onCategorize}
          activeOpacity={0.8}
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radii.full,
              paddingVertical: spacing.xs + 2,
              paddingHorizontal: spacing.md,
              marginRight: spacing.xs,
            },
          ]}
        >
          <Tag size={14} color={colors.primary} />
          <Text
            style={[
              styles.actionLabel,
              {
                color: colors.primary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
                marginLeft: spacing.xxs + 2,
              },
            ]}
          >
            Categorize
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDelete}
          activeOpacity={0.8}
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.statusDangerLight,
              borderRadius: radii.full,
              paddingVertical: spacing.xs + 2,
              paddingHorizontal: spacing.md,
              marginRight: spacing.sm,
            },
          ]}
        >
          <Trash2 size={14} color={colors.statusDanger} />
          <Text
            style={[
              styles.actionLabel,
              {
                color: colors.statusDanger,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
                marginLeft: spacing.xxs + 2,
              },
            ]}
          >
            Delete
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Clear selection"
          onPress={onCancel}
          style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}
        >
          <X size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 900,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  countText: {},
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionLabel: {},
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
