import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button, DatePicker, Dropdown } from '../../design';
import { t } from '../../i18n';
import { formatNaira, parseAmount } from '../../money';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { isSavingsAccount, PURPOSE_INFO } from '../accounts/purpose';

/** What the sheet hands back; GoalsScreen saves it. */
export interface NewGoal {
  name: string;
  targetMinor: bigint;
  targetDate?: string;
  /** An existing savings account, or null to make the one described in `newAccount`. */
  accountId: string | null;
  newAccount?: { name: string; balanceMinor: bigint };
  /** An existing budget category, 'new' for a Savings line named after the goal, or undefined. */
  budget?: string;
}

interface CreateGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goal: NewGoal) => Promise<boolean>;
}

const NEW_ACCOUNT = '__new';
const NEW_BUDGET = 'new';

/** Whole months from today until a YYYY-MM-DD date, at least one. */
function monthsUntil(date: string): number {
  const now = new Date();
  const [y, m] = date.split('-').map(Number);
  if (!y || !m) return 0;
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
}

export function CreateGoalSheet({ visible, onClose, onSave }: CreateGoalSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const { accounts, categories } = useDatabaseData();

  const savingsAccounts = useMemo(() => accounts.filter(isSavingsAccount), [accounts]);
  const savingsCategories = useMemo(
    () => categories.filter((c) => c.kind === 'expense' && !c.deleted && !c.hidden && c.budgetType === 'savings'),
    [categories],
  );

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [accountChoice, setAccountChoice] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Each time the sheet opens: start clean, keep money in the first savings account (or a new one).
  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setName('');
      setAmountText('');
      setTargetDate('');
      setNewAccountName('');
      setNewAccountBalance('');
      setBudget('');
      setError('');
      setAccountChoice(savingsAccounts[0]?.id ?? NEW_ACCOUNT);
    }
  }

  const creatingAccount = accountChoice === NEW_ACCOUNT || savingsAccounts.length === 0;
  const parsedTarget = parseAmount(amountText);
  const monthly =
    parsedTarget.ok && parsedTarget.minor > 0n && targetDate
      ? parsedTarget.minor / BigInt(monthsUntil(targetDate) || 1)
      : null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('goals.create.nameRequired'));
      return;
    }
    if (!parsedTarget.ok || parsedTarget.minor <= 0n) {
      setError(t('goals.create.targetRequired'));
      return;
    }
    if (creatingAccount && !newAccountName.trim()) {
      setError(t('goals.create.accountRequired'));
      return;
    }
    const balance = parseAmount(newAccountBalance);
    setSaving(true);
    const ok = await onSave({
      name: name.trim(),
      targetMinor: parsedTarget.minor,
      targetDate: targetDate || undefined,
      accountId: creatingAccount ? null : accountChoice,
      newAccount: creatingAccount
        ? { name: newAccountName.trim(), balanceMinor: balance.ok && balance.minor > 0n ? balance.minor : 0n }
        : undefined,
      budget: budget || undefined,
    });
    setSaving(false);
    if (!ok) {
      setError(t('goals.create.failed'));
      return;
    }
    onClose();
  };

  const hint = { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.sm };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('goals.create.title')}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput
            label={t('goals.create.name')}
            placeholder={t('goals.create.namePlaceholder')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.sm }}>
          <CurrencyInput label={t('goals.create.target')} value={amountText} onChangeText={setAmountText} />
        </View>

        <View style={{ marginBottom: spacing.sm, zIndex: 30 }}>
          <DatePicker
            label={t('goals.create.date')}
            placeholder={t('goals.create.datePlaceholder')}
            value={targetDate}
            onChange={setTargetDate}
          />
          {monthly !== null && (
            <Text style={[hint, { marginTop: spacing.xs }]}>{t('goals.create.monthly', { amount: formatNaira(monthly) })}</Text>
          )}
        </View>

        <View style={{ marginBottom: spacing.sm, zIndex: 20 }}>
          {savingsAccounts.length > 0 ? (
            <>
              <Dropdown
                label={t('goals.create.keepIn')}
                value={accountChoice}
                options={[
                  ...savingsAccounts.map((a) => ({
                    label: a.name,
                    value: a.id,
                    subtitle: a.purpose ? PURPOSE_INFO[a.purpose].label : undefined,
                  })),
                  { label: t('goals.create.newAccount'), value: NEW_ACCOUNT },
                ]}
                onSelect={setAccountChoice}
              />
              <Text style={[hint, { marginTop: spacing.xs }]}>{t('goals.create.keepInHint')}</Text>
            </>
          ) : (
            <Text style={[hint, { marginBottom: spacing.xs }]}>{t('goals.create.noSavings')}</Text>
          )}
        </View>

        {creatingAccount && (
          <View style={{ marginBottom: spacing.sm }}>
            <TextInput
              label={t('goals.create.accountName')}
              placeholder={t('goals.create.accountNamePlaceholder')}
              value={newAccountName}
              onChangeText={setNewAccountName}
            />
            <View style={{ marginTop: spacing.sm }}>
              <CurrencyInput label={t('goals.create.accountBalance')} value={newAccountBalance} onChangeText={setNewAccountBalance} />
            </View>
          </View>
        )}

        <View style={{ marginBottom: spacing.md, zIndex: 10 }}>
          <Dropdown
            label={t('goals.create.budget')}
            value={budget}
            options={[
              { label: t('goals.create.budgetNone'), value: '' },
              { label: t('goals.create.budgetNew', { name: name.trim() || t('goals.savingsGroup') }), value: NEW_BUDGET },
              ...savingsCategories.map((c) => ({ label: c.name, value: c.id })),
            ]}
            onSelect={setBudget}
          />
        </View>

        <Button label={t('goals.create.save')} onPress={() => void handleSave()} variant="primary" size="md" loading={saving} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
  },
});
