import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { parseAmount, toInputText } from '../../money';
import type { AccountData } from './AccountCardRow';

import { t } from '../../i18n';
import { useSyncOnChange } from '../../lib/useSyncOnChange';
export interface UpdateAssetValueSheetProps {
  visible: boolean;
  onClose: () => void;
  account: AccountData | null;
  onUpdateValue: (id: string, newBalanceMinor: bigint) => void;
}

export function UpdateAssetValueSheet({
  visible,
  onClose,
  account,
  onUpdateValue,
}: UpdateAssetValueSheetProps) {
  const { colors, typography, spacing } = useTheme();

  const [valText, setValText] = useState('');
  const [error, setError] = useState('');

  // Fill the fields from the props when the sheet opens or what it shows changes.
  useSyncOnChange([account], () => {
    if (account) {
      const absMinor = account.balanceMinor < 0n ? -account.balanceMinor : account.balanceMinor;
      setValText(toInputText(absMinor));
    }
  });

  if (!account) return null;

  const handleSave = () => {
    const parsed = parseAmount(valText);
    if (!parsed.ok || parsed.minor < 0n) {
      setError(t('quick.amountRequired'));
      return;
    }
    setError('');
    const minor = parsed.minor;
    onUpdateValue(account.id, minor);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Update ${account.name} Value`}
      subtitle="Revaluation updates net worth without counting as income or expense"
    >
      <View style={styles.form}>
        <CurrencyInput
          value={valText}
          onChangeText={(v) => {
            setValText(v);
            if (error) setError('');
          }}
          label={t('ui.updateAssetValueSheet.currentMarketValue')}
          error={error}
        />

        <Text
          style={[
            styles.notice,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: spacing.sm,
            },
          ]}
        >
          {t('ui.updateAssetValueSheet.changesInPropertyOrAsset')}
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <Button label={t('ui.updateAssetValueSheet.saveNewValue')} onPress={handleSave} variant="primary" size="lg" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
  notice: {},
});
