import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';
import { formatNaira } from '../../money';

interface DiscrepancyAdjustmentSheetProps {
  visible: boolean;
  onClose: () => void;
  discrepancyMinor: bigint;
  onConfirmAdjustment: (reason: string) => void;
}

export function DiscrepancyAdjustmentSheet({
  visible,
  onClose,
  discrepancyMinor,
  onConfirmAdjustment,
}: DiscrepancyAdjustmentSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [reason, setReason] = useState('Reconciliation Adjustment');

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Balance Adjustment">
      <View style={styles.container}>
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.statusWarningLight,
              borderColor: colors.statusWarning,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AlertCircle size={18} color={colors.statusWarning} />
            <Text
              style={{
                color: colors.statusWarning,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              Unexplained Difference
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
            Your cleared balance differs from your bank statement by{' '}
            <Text style={{ fontFamily: typography.fonts.semiBold }}>
              {formatNaira(discrepancyMinor)}
            </Text>
            . We can create a balancing entry to bring your ledger in sync.
          </Text>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label="Adjustment Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Unaccounted bank fee or rounding"
          />
        </View>

        <Button
          label="Post Adjustment & Finish"
          onPress={() => {
            onConfirmAdjustment(reason);
            onClose();
          }}
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
  banner: {
    borderWidth: 1,
  },
});
