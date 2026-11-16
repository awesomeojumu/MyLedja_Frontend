import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { toInputText } from '../../money';
import type { AccountData } from './AccountCardRow';

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

  useEffect(() => {
    if (account) {
      const absMinor = account.balanceMinor < 0n ? -account.balanceMinor : account.balanceMinor;
      setValText(toInputText(absMinor));
    }
  }, [account]);

  if (!account) return null;

  const handleSave = () => {
    if (!valText || parseFloat(valText) < 0) {
      setError('Please enter a valid asset valuation');
      return;
    }
    setError('');
    const minor = BigInt(Math.round(parseFloat(valText) * 100));
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
          label="Current Market Value"
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
          Changes in property or asset values represent unrealized capital balance adjustments, not taxable income.
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <Button label="Save New Value" onPress={handleSave} variant="primary" size="lg" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
  notice: {},
});
