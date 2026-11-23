import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';
import { formatNaira } from '../../money';

import { t } from '../../i18n';
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
    <BottomSheet visible={visible} onClose={onClose} title={t('ui.discrepancyAdjustmentSheet.balanceAdjustment')}>
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
              {t('ui.discrepancyAdjustmentSheet.unexplainedDifference')}
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
            {t('ui.discrepancyAdjustmentSheet.yourClearedBalanceDiffersFrom')}{' '}
            <Text style={{ fontFamily: typography.fonts.semiBold }}>
              {formatNaira(discrepancyMinor)}
            </Text>
            {t('ui.discrepancyAdjustmentSheet.weCanCreateABalancing')}
          </Text>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={t('ui.discrepancyAdjustmentSheet.adjustmentReason')}
            value={reason}
            onChangeText={setReason}
            placeholder={t('ui.discrepancyAdjustmentSheet.eGUnaccountedBankFee')}
          />
        </View>

        <Button
          label={t('ui.discrepancyAdjustmentSheet.postAdjustmentAndFinish')}
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
