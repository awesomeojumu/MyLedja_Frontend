import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

import { t } from '../../i18n';
interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export function DeleteAccountModal({
  visible,
  onClose,
  onConfirmDelete,
}: DeleteAccountModalProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('ui.deleteAccountModal.deleteAccountAndWorkspace')}>
      <View style={styles.container}>
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.statusDangerLight,
              borderColor: colors.statusDanger,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
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
              {t('ui.deleteAccountModal.irreversibleAction')}
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
            {t('ui.deleteAccountModal.allBankAccountsHistoricalTransactions')}
          </Text>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={t('ui.deleteAccountModal.typeDeleteToConfirm')}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={t('ui.deleteAccountModal.delete')}
            autoCapitalize="characters"
          />
        </View>

        <Button
          label={t('ui.deleteAccountModal.permanentlyDeleteWorkspace')}
          onPress={() => {
            if (canDelete) {
              onConfirmDelete();
              onClose();
            }
          }}
          variant="danger"
          size="lg"
          disabled={!canDelete}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  banner: {
    borderWidth: 1,
  },
});
