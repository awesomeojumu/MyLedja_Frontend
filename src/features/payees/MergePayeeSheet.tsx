import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import type { PayeeItem } from './EditPayeeSheet';

import { t } from '../../i18n';
interface MergePayeeSheetProps {
  visible: boolean;
  onClose: () => void;
  sourcePayee: PayeeItem;
  otherPayees: PayeeItem[];
  onConfirmMerge: (targetPayeeId: string) => void;
}

export function MergePayeeSheet({
  visible,
  onClose,
  sourcePayee,
  otherPayees,
  onConfirmMerge,
}: MergePayeeSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [targetId, setTargetId] = useState<string | null>(null);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Merge ${sourcePayee.name}`}>
      <View style={styles.container}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.bodySm,
            marginBottom: spacing.md,
          }}
        >
          {t('ui.mergePayeeSheet.selectTheMasterPayeeTo')}
        </Text>

        {otherPayees.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => setTargetId(p.id)}
            style={[
              styles.payeeRow,
              {
                backgroundColor: targetId === p.id ? colors.primaryLight : colors.surfaceSubtle,
                borderColor: targetId === p.id ? colors.primary : colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.xs,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                {p.name}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                {p.txCount}{' '}{t('ui.mergePayeeSheet.transactions')}
              </Text>
            </View>
            {targetId === p.id && <Check size={16} color={colors.primary} />}
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={t('ui.mergePayeeSheet.confirmAndMergePayees')}
            onPress={() => {
              if (targetId) onConfirmMerge(targetId);
              onClose();
            }}
            variant="primary"
            size="lg"
            disabled={!targetId}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  payeeRow: {
    borderWidth: 1,
  },
});
