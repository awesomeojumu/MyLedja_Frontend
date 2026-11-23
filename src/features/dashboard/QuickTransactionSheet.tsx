import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Dropdown, Button } from '../../design';
import { t } from '../../i18n';
import { parseAmount } from '../../money';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { useCategoryTree } from '../categories/catalog';
import { isSavingsAccount, isSpendingAccount } from '../accounts/purpose';
import { recordEntry, type QuickEntry } from '../transactions/recordEntry';

export interface QuickTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  type: 'expense' | 'income';
  /** Called after a save went through, with a short line for a toast. */
  onSaved?: (message: string) => void;
  defaultAccountId?: string;
  defaultCategoryId?: string;
  /** Shows a money out / money in switch (the account page uses one sheet for both). */
  allowTypeSwitch?: boolean;
}

const SAVE = '__save';
const DEBT = '__debt';

const todayIso = () => new Date().toISOString().slice(0, 10);

export function QuickTransactionSheet({
  visible,
  onClose,
  type: initialType,
  onSaved,
  defaultAccountId,
  defaultCategoryId,
  allowTypeSwitch = false,
}: QuickTransactionSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { repo, accounts, goals, holdings, debts } = useDatabaseData();
  const [type, setType] = useState(initialType);
  // `choice` is a category's key; `detail` is the id of a subcategory under it, or '' for the general line.
  const expenseChoices = useCategoryTree('expense');
  const incomeChoices = useCategoryTree('income');
  const choices = type === 'income' ? incomeChoices : expenseChoices;

  const liveAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const payAccounts = useMemo(() => {
    const spending = liveAccounts.filter(isSpendingAccount);
    return spending.length > 0 ? spending : liveAccounts;
  }, [liveAccounts]);
  const openDebts = useMemo(
    () => debts.filter((d) => d.status === 'open' && d.direction === (type === 'expense' ? 'iOwe' : 'owedToMe')),
    [debts, type],
  );

  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [choice, setChoice] = useState('');
  const [detail, setDetail] = useState('');
  const [target, setTarget] = useState('');
  const [units, setUnits] = useState('1');
  const [payee, setPayee] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fresh defaults each time the sheet opens or switches between expense and income.
  const openKey = visible ? initialType : 'closed';
  const [openedFor, setOpenedFor] = useState('closed');
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (visible) {
      setType(initialType);
      setAmount('');
      setPayee('');
      setDetail('');
      setTarget('');
      setUnits('1');
      setError('');
      setAccountId(
        defaultAccountId && liveAccounts.some((a) => a.id === defaultAccountId) ? defaultAccountId : (payAccounts[0]?.id ?? ''),
      );
      const startChoices = initialType === 'income' ? incomeChoices : expenseChoices;
      const start = defaultCategoryId
        ? startChoices.find((c) => c.generalId === defaultCategoryId || c.children.some((k) => k.id === defaultCategoryId))
        : undefined;
      setChoice(start?.key ?? '');
      setDetail(start && start.generalId !== defaultCategoryId ? (defaultCategoryId ?? '') : '');
    }
  }

  const selectedCategory = choices.find((c) => c.key === choice);

  const categoryOptions = useMemo(() => {
    const opts = choices.map((c) => ({
      label: c.name,
      value: c.key,
      subtitle: c.children.length > 0 ? c.children.slice(0, 3).map((k) => k.name).join(', ') : undefined,
    }));
    if (type === 'expense') opts.push({ label: t('quick.optionSave'), value: SAVE, subtitle: t('quick.optionSaveBody') });
    opts.push(
      type === 'expense'
        ? { label: t('quick.optionDebtOut'), value: DEBT, subtitle: t('quick.optionDebtOutBody') }
        : { label: t('quick.optionDebtIn'), value: DEBT, subtitle: t('quick.optionDebtInBody') },
    );
    return opts;
  }, [choices, type]);

  const saveTargets = useMemo(() => {
    const nameOf = (id: string) => liveAccounts.find((a) => a.id === id)?.name ?? '';
    return [
      ...goals
        .filter((g) => g.status === 'active')
        .map((g) => ({ label: t('quick.targetGoal', { name: g.name }), value: `goal:${g.id}`, subtitle: nameOf(g.accountId) })),
      ...liveAccounts
        .filter((a) => isSavingsAccount(a) && a.id !== accountId)
        .map((a) => ({ label: t('quick.targetAccount', { name: a.name }), value: `acct:${a.id}` })),
      ...holdings
        .filter((h) => !h.archived && !h.isWrittenOff)
        .map((h) => ({ label: t('quick.targetHolding', { name: h.name }), value: `hold:${h.id}`, subtitle: h.symbol })),
    ];
  }, [goals, liveAccounts, holdings, accountId]);

  const handleSave = async () => {
    const parsed = parseAmount(amount);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError(t('quick.amountRequired'));
      return;
    }
    if (!choice) {
      setError(t('quick.categoryRequired'));
      return;
    }
    const date = todayIso();
    let entry: QuickEntry;
    let done: string;
    if (choice === SAVE) {
      const [kind, id] = target.split(':');
      if (!kind || !id) {
        setError(t('quick.targetRequired'));
        return;
      }
      if (kind === 'goal') {
        entry = { flow: 'goal', fromAccountId: accountId, goalId: id, amount: parsed.minor, date };
        done = t('quick.savedGoal', { name: goals.find((g) => g.id === id)?.name ?? '' });
      } else if (kind === 'acct') {
        entry = { flow: 'saveTransfer', fromAccountId: accountId, toAccountId: id, amount: parsed.minor, date };
        done = t('quick.savedTransfer', { name: liveAccounts.find((a) => a.id === id)?.name ?? '' });
      } else {
        entry = { flow: 'invest', fromAccountId: accountId, holdingId: id, amount: parsed.minor, units: units.trim() || '1', date };
        done = t('quick.savedInvest', { name: holdings.find((h) => h.id === id)?.name ?? '' });
      }
    } else if (choice === DEBT) {
      if (!target) {
        setError(t('quick.debtRequired'));
        return;
      }
      entry = { flow: 'debt', accountId, debtId: target, amount: parsed.minor, date };
      done = t('quick.savedDebt');
    } else {
      entry = {
        flow: type,
        accountId,
        // The subcategory picked, else the category's general line.
        categoryId: detail || selectedCategory?.generalId || '',
        amount: parsed.minor,
        date,
        payee,
      };
      done = type === 'expense' ? t('quick.savedExpense') : t('quick.savedIncome');
    }

    setSaving(true);
    const result = await recordEntry(repo, entry);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved?.(done);
    onClose();
  };

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  const hint = { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.sm };
  const gap = { marginTop: spacing.sm + 2 };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={type === 'expense' ? t('quick.titleExpense') : t('quick.titleIncome')}
    >
      {liveAccounts.length === 0 ? (
        <View style={styles.form}>
          <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md }}>
            {t('quick.noAccountsTitle')}
          </Text>
          <Text style={[hint, { marginTop: spacing.xs, marginBottom: spacing.md }]}>{t('quick.noAccountsBody')}</Text>
          <Button label={t('quick.addAccount')} onPress={() => go('/accounts')} variant="primary" size="md" />
        </View>
      ) : (
        <View style={styles.form}>
          {allowTypeSwitch && (
            <Dropdown
              label={t('quick.direction')}
              value={type}
              options={[
                { label: t('quick.moneyOut'), value: 'expense' },
                { label: t('quick.moneyIn'), value: 'income' },
              ]}
              onSelect={(v) => {
                setType(v as 'expense' | 'income');
                setChoice('');
                setDetail('');
                setTarget('');
              }}
              containerStyle={{ marginBottom: spacing.sm + 2 }}
            />
          )}
          <CurrencyInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              if (error) setError('');
            }}
            error={error}
          />

          <Dropdown
            label={type === 'expense' ? t('quick.paidFrom') : t('quick.paidInto')}
            value={accountId}
            options={payAccounts.map((a) => ({ label: a.name, value: a.id, subtitle: a.institution }))}
            onSelect={setAccountId}
            containerStyle={gap}
          />

          <Dropdown
            label={t('quick.category')}
            placeholder={t('quick.chooseCategory')}
            value={choice}
            options={categoryOptions}
            onSelect={(v) => {
              setChoice(v);
              setDetail('');
              setTarget('');
              if (error) setError('');
            }}
            containerStyle={gap}
          />

          {selectedCategory && selectedCategory.children.length > 0 && (
            <Dropdown
              label={t('quick.detail')}
              value={detail}
              options={[
                { label: t('quick.detailNone'), value: '' },
                ...selectedCategory.children.map((k) => ({ label: k.name, value: k.id })),
              ]}
              onSelect={setDetail}
              containerStyle={gap}
            />
          )}

          {choice === SAVE &&
            (saveTargets.length > 0 ? (
              <>
                <Dropdown
                  label={t('quick.saveTo')}
                  placeholder={t('quick.chooseTarget')}
                  value={target}
                  options={saveTargets}
                  onSelect={setTarget}
                  containerStyle={gap}
                />
                {target.startsWith('hold:') && (
                  <TextInput label={t('quick.units')} value={units} onChangeText={setUnits} keyboardType="decimal-pad" containerStyle={gap} />
                )}
              </>
            ) : (
              <View style={gap}>
                <Text style={[hint, { marginBottom: spacing.sm }]}>{t('quick.saveEmpty')}</Text>
                <View style={styles.row}>
                  <Button label={t('quick.addGoal')} onPress={() => go('/goals')} variant="secondary" size="sm" />
                  <Button label={t('quick.addSavingsAccount')} onPress={() => go('/accounts')} variant="secondary" size="sm" />
                </View>
              </View>
            ))}

          {choice === DEBT &&
            (openDebts.length > 0 ? (
              <Dropdown
                label={t('quick.debt')}
                placeholder={t('quick.chooseDebt')}
                value={target}
                options={openDebts.map((d) => ({ label: d.name, value: d.id }))}
                onSelect={setTarget}
                containerStyle={gap}
              />
            ) : (
              <Text style={[hint, gap]}>{t('quick.debtEmpty')}</Text>
            ))}

          {choice !== SAVE && choice !== DEBT && (
            <TextInput
              label={t('quick.payee')}
              placeholder={type === 'income' ? t('quick.payeePlaceholderIncome') : t('quick.payeePlaceholderExpense')}
              value={payee}
              onChangeText={setPayee}
              containerStyle={gap}
            />
          )}

          <View style={{ marginTop: spacing.md + 2 }}>
            <Button label={t('quick.save')} onPress={() => void handleSave()} variant="primary" size="md" loading={saving} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
