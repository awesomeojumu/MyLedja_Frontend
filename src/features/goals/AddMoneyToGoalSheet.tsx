import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Button, Dropdown } from '../../design';
import { t } from '../../i18n';
import { parseAmount, formatNaira } from '../../money';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface AddMoneyToGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  goalName: string;
  /** The account the goal's money is kept in. */
  goalAccountId: string;
  targetMinor: bigint;
  currentMinor: bigint;
  /** Saves the allocation; resolves false when it did not go through. */
  onTransfer: (amountMinor: bigint, fromAccountId: string) => Promise<boolean>;
}

export function AddMoneyToGoalSheet({
  visible,
  onClose,
  goalName,
  goalAccountId,
  targetMinor,
  currentMinor,
  onTransfer,
}: AddMoneyToGoalSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { accounts } = useDatabaseData();
  const live = accounts.filter((a) => !a.archived);

  const [fromId, setFromId] = useState(goalAccountId);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const remainingToGoal = targetMinor - currentMinor;
  const goalAccountName = live.find((a) => a.id === goalAccountId)?.name ?? goalName;

  const handleSave = async () => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError(t('quick.amountRequired'));
      return;
    }
    setSaving(true);
    const ok = await onTransfer(parsed.minor, fromId || goalAccountId);
    setSaving(false);
    if (!ok) {
      setError(t('quick.error.generic'));
      return;
    }
    setAmountText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('goals.add.title', { name: goalName })}>
      <View style={styles.container}>
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md }}>
            {t('goals.add.remaining', { amount: formatNaira(remainingToGoal > 0n ? remainingToGoal : 0n) })}
          </Text>
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label={t('goals.add.amount')}
            value={amountText}
            onChangeText={(v) => {
              setAmountText(v);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <Dropdown
          label={t('goals.add.from')}
          value={fromId}
          options={live.map((a) => ({ label: a.name, value: a.id, subtitle: a.institution }))}
          onSelect={setFromId}
        />
        {fromId !== goalAccountId && (
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.sm,
              marginTop: spacing.xs,
            }}
          >
            {t('goals.add.fromHint', { name: goalAccountName })}
          </Text>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Button label={t('goals.add.save')} onPress={() => void handleSave()} variant="primary" size="lg" loading={saving} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  infoCard: {
    borderWidth: 1,
  },
});
