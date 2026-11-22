import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Dropdown, Button } from '../../design';
import { t } from '../../i18n';
import { parseAmount } from '../../money';
import type { AccountKind } from '../../data/workspace/model';
import { ACCOUNT_PURPOSES, PURPOSE_INFO, type AccountPurpose } from './purpose';

/** What the sheet hands back: a real ledger kind plus the purpose the person chose. */
export interface NewAccount {
  name: string;
  institution?: string;
  purpose: AccountPurpose;
  type: AccountKind;
  balanceMinor: bigint;
}

interface AddAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaveAccount: (account: NewAccount) => void;
  /** Opens with this purpose picked, for "Add a savings account" shortcuts. */
  initialPurpose?: AccountPurpose;
}

export function AddAccountSheet({ visible, onClose, onSaveAccount, initialPurpose = 'operating' }: AddAccountSheetProps) {
  const { spacing } = useTheme();

  const [purpose, setPurpose] = useState<AccountPurpose>(initialPurpose);
  const [institution, setInstitution] = useState('');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState('');

  // Each time the sheet opens, start from the purpose it was opened for.
  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) setPurpose(initialPurpose);
  }

  const reset = () => {
    setName('');
    setInstitution('');
    setBalance('');
    setError('');
  };

  const handleSave = () => {
    const info = PURPOSE_INFO[purpose];
    const finalName = name.trim() || institution.trim();
    if (!finalName) {
      setError(t('account.sheet.nameRequired'));
      return;
    }
    const parsed = parseAmount(balance);
    onSaveAccount({
      name: finalName,
      institution: institution.trim() || undefined,
      purpose,
      type: info.kind,
      balanceMinor: parsed.ok && parsed.minor > 0n ? parsed.minor : 0n,
    });
    reset();
    onClose();
  };

  const options = ACCOUNT_PURPOSES.map((p) => ({
    label: PURPOSE_INFO[p].label,
    value: p,
    subtitle: PURPOSE_INFO[p].subtitle,
  }));

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('account.sheet.title')}
    >
      <View style={styles.form}>
        <View style={{ marginBottom: spacing.md }}>
          <Dropdown
            label={t('account.sheet.purpose')}
            value={purpose}
            options={options}
            onSelect={(val) => setPurpose(val as AccountPurpose)}
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={t('account.sheet.institution')}
            placeholder={t('account.sheet.institutionPlaceholder')}
            value={institution}
            onChangeText={setInstitution}
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={t('account.sheet.name')}
            placeholder={t('account.sheet.namePlaceholder')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput value={balance} onChangeText={setBalance} label={t('account.sheet.balance')} />
        </View>

        <Button label={t('account.sheet.save')} onPress={handleSave} variant="primary" size="lg" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
