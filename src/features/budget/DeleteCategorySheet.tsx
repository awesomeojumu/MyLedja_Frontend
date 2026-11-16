import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

interface DeleteCategorySheetProps {
  visible: boolean;
  onClose: () => void;
  categoryName: string;
  onConfirmDelete: () => void;
}

export function DeleteCategorySheet({
  visible,
  onClose,
  categoryName,
  onConfirmDelete,
}: DeleteCategorySheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Delete Category">
      <View style={styles.container}>
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.statusDangerLight,
              borderColor: colors.statusDanger,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AlertCircle size={18} color={colors.statusDanger} />
            <Text
              style={{
                color: colors.statusDanger,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              Confirm Deletion
            </Text>
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.bodySm,
              marginTop: spacing.xs,
            }}
          >
            Are you sure you want to delete <Text style={{ fontFamily: typography.fonts.semiBold }}>{categoryName}</Text>? Past transactions will be moved to Uncategorized.
          </Text>
        </View>

        <Button
          label="Delete Envelope"
          onPress={() => {
            onConfirmDelete();
            onClose();
          }}
          variant="danger"
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
  banner: {
    borderWidth: 1,
  },
});
