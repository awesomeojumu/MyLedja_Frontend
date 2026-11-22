import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, BottomSheet, CurrencyInput, Dropdown, Button } from '../../design';
import { t } from '../../i18n';
import { formatNaira, parseAmount } from '../../money';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { recordEntry } from '../transactions/recordEntry';

export interface QuickTransferSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after the transfer saved, with a short line for a toast. */
  onSaved?: (message: string) => void;
}

export function QuickTransferSheet({ visible, onClose, onSaved }: QuickTransferSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { repo, accounts } = useDatabaseData();
  const live = accounts.filter((a) => !a.archived);

  const [openedFor, setOpenedFor] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fresh defaults each time the sheet opens.
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setFromId(live[0]?.id ?? '');
      setToId(live[1]?.id ?? '');
      setAmount('');
      setError('');
    }
  }

  const options = live.map((a) => ({ label: a.name, value: a.id, subtitle: a.institution }));

  const handleConfirm = async () => {
    const parsed = parseAmount(amount);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError(t('quick.amountRequired'));
      return;
    }
    if (!fromId || !toId || fromId === toId) {
      setError(t('transfer.sameAccount'));
      return;
    }
    setSaving(true);
    const result = await recordEntry(repo, {
      flow: 'saveTransfer',
      fromAccountId: fromId,
      toAccountId: toId,
      amount: parsed.minor,
      date: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved?.(t('transfer.saved', { amount: formatNaira(parsed.minor), name: live.find((a) => a.id === toId)?.name ?? '' }));
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('transfer.title')} subtitle={t('transfer.subtitle')}>
      {live.length < 2 ? (
        <View style={styles.form}>
          <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, marginBottom: spacing.md }}>
            {t('transfer.needTwo')}
          </Text>
          <Button
            label={t('quick.addAccount')}
            onPress={() => {
              onClose();
              router.push('/accounts' as never);
            }}
            variant="primary"
            size="md"
          />
        </View>
      ) : (
        <View style={styles.form}>
          <CurrencyInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              if (error) setError('');
            }}
            error={error}
          />
          <Dropdown
            label={t('transfer.from')}
            value={fromId}
            options={options}
            onSelect={setFromId}
            containerStyle={{ marginTop: spacing.sm + 2 }}
          />
          <Dropdown
            label={t('transfer.to')}
            value={toId}
            options={options}
            onSelect={setToId}
            containerStyle={{ marginTop: spacing.sm + 2 }}
          />
          <View style={{ marginTop: spacing.md + 2 }}>
            <Button label={t('transfer.save')} onPress={() => void handleConfirm()} variant="primary" size="md" loading={saving} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
