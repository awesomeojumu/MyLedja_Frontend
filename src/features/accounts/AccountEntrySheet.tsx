import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Dropdown, Button } from '../../design';
import { parseAmount } from '../../money';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';

export type EntryType = 'expense' | 'income' | 'transfer';

export interface AccountEntrySheetProps {
  visible: boolean;
  onClose: () => void;
  currentAccountName: string;
  availableAccounts?: string[];
  onSaveEntry: (entry: {
    type: EntryType;
    amountMinor: bigint;
    category: string;
    payee: string;
    destinationAccount?: string;
    cleared: boolean;
  }) => void;
}

const ENTRY_TYPE_OPTIONS = [
  { label: 'Expense (Money Out)', value: 'expense', subtitle: 'Purchases, bills, daily spending' },
  { label: 'Income (Money In)', value: 'income', subtitle: 'Salary, profit, deposits, gifts' },
  { label: 'Transfer (Between Accounts)', value: 'transfer', subtitle: 'Move money to or from another account' },
];

const DEFAULT_ACCOUNTS = [
  'PremiumTrust Bank',
  'GTBank (Current)',
  'High-Yield Savings Pot',
  'Emergency Reserve Vault',
  'Target Savings Pot',
  'Cash Wallet',
];

export function AccountEntrySheet({
  visible,
  onClose,
  currentAccountName,
  availableAccounts = DEFAULT_ACCOUNTS,
  onSaveEntry,
}: AccountEntrySheetProps) {
  const { spacing } = useTheme();
  const {
    getExpenseOptions,
    getIncomeOptions,
    getSubcategoriesForExpense,
    getSubcategoriesForIncome,
  } = useCategoryPreferences();

  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [payee, setPayee] = useState('');
  const [destinationAccount, setDestinationAccount] = useState(
    availableAccounts.find((a) => a !== currentAccountName) || availableAccounts[0] || 'GTBank (Current)'
  );
  const [error, setError] = useState('');

  const expenseOptions = useMemo(() => getExpenseOptions(), [getExpenseOptions]);
  const incomeOptions = useMemo(() => getIncomeOptions(), [getIncomeOptions]);

  // Set default category on mount or when entry type changes
  useEffect(() => {
    if (entryType === 'income') {
      setCategory(incomeOptions[0]?.value || 'Employment');
      setSubcategory('');
    } else if (entryType === 'expense') {
      setCategory(expenseOptions[0]?.value || 'Food');
      setSubcategory('');
    } else {
      setCategory('Transfer');
      setSubcategory('');
    }
  }, [entryType, expenseOptions, incomeOptions]);

  // Available subcategories for current selected category
  const availableSubcategories = useMemo(() => {
    if (entryType === 'transfer' || !category) return [];
    const list =
      entryType === 'income'
        ? getSubcategoriesForIncome(category)
        : getSubcategoriesForExpense(category);
    return list;
  }, [entryType, category, getSubcategoriesForExpense, getSubcategoriesForIncome]);

  const subcategoryOptions = useMemo(() => {
    if (availableSubcategories.length === 0) return [];
    return [
      { label: 'None (General / Unspecified)', value: '' },
      ...availableSubcategories.map((sub) => ({ label: sub, value: sub })),
    ];
  }, [availableSubcategories]);

  const handleEntryTypeChange = (newTypeStr: string) => {
    const newType = newTypeStr as EntryType;
    setEntryType(newType);
  };

  const handleSave = () => {
    const parsed = parseAmount(amount);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }
    setError('');

    // If subcategory is selected, combine cleanly as "Category: Subcategory", else just "Category"
    const finalCategory =
      entryType === 'transfer'
        ? 'Transfer'
        : subcategory
        ? `${category}: ${subcategory}`
        : category;

    onSaveEntry({
      type: entryType,
      amountMinor: parsed.minor,
      category: finalCategory,
      payee:
        entryType === 'transfer'
          ? `Transfer to ${destinationAccount}`
          : payee.trim() || (entryType === 'income' ? 'Deposit' : 'Expense'),
      destinationAccount: entryType === 'transfer' ? destinationAccount : undefined,
      cleared: true,
    });

    setAmount('');
    setPayee('');
    setSubcategory('');
    setEntryType('expense');
    onClose();
  };

  // Build category options based on type
  const categoryOptions = entryType === 'income' ? incomeOptions : expenseOptions;

  // Build other destination accounts for transfer
  const destinationOptions = availableAccounts
    .filter((acc) => acc !== currentAccountName)
    .map((acc) => ({ label: acc, value: acc }));

  const modalTitle =
    entryType === 'income'
      ? 'Add Income Entry'
      : entryType === 'transfer'
      ? 'Transfer Money'
      : 'Add Expense Entry';

  const modalSubtitle =
    entryType === 'income'
      ? `Recording inflow to ${currentAccountName}`
      : entryType === 'transfer'
      ? `Moving funds from ${currentAccountName}`
      : `Recording outflow from ${currentAccountName}`;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
    >
      <View style={styles.form}>
        {/* 1. Entry Type Dropdown (Expense, Income, Transfer) */}
        <View style={{ marginBottom: spacing.md }}>
          <Dropdown
            label="Entry Type"
            placeholder="Select Entry Type"
            value={entryType}
            options={ENTRY_TYPE_OPTIONS}
            onSelect={handleEntryTypeChange}
          />
        </View>

        {/* 2. Amount Input */}
        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              if (error) setError('');
            }}
            error={error}
            label="Amount"
            placeholder="0.00"
          />
        </View>

        {/* 3. Category Dropdown (for Expense and Income) */}
        {entryType !== 'transfer' ? (
          <>
            <View style={{ marginBottom: spacing.md }}>
              <Dropdown
                label={entryType === 'income' ? 'Income Category' : 'Expense Category'}
                placeholder="Select Category"
                value={category}
                options={categoryOptions}
                onSelect={(val) => {
                  setCategory(val);
                  setSubcategory(''); // Reset subcategory when category changes
                }}
              />
            </View>

            {/* Optional Subcategory Dropdown */}
            {subcategoryOptions.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Dropdown
                  label="Subcategory (Optional)"
                  placeholder="Select Subcategory"
                  value={subcategory}
                  options={subcategoryOptions}
                  onSelect={setSubcategory}
                />
              </View>
            )}
          </>
        ) : (
          /* Transfer Destination Dropdown */
          <View style={{ marginBottom: spacing.md }}>
            <Dropdown
              label="Transfer To Account"
              placeholder="Select Destination Account"
              value={destinationAccount}
              options={destinationOptions}
              onSelect={setDestinationAccount}
            />
          </View>
        )}

        {/* 4. Payee / Description Input */}
        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={
              entryType === 'income'
                ? 'Source / Payer (Optional)'
                : entryType === 'transfer'
                ? 'Transfer Note (Optional)'
                : 'Payee / Merchant (Optional)'
            }
            placeholder={
              entryType === 'income'
                ? 'e.g. Employer, Client, Refund'
                : entryType === 'transfer'
                ? 'e.g. Funding savings pot, Emergency cushion'
                : 'e.g. Bolt, Shoprite, Netflix, TotalEnergies'
            }
            value={payee}
            onChangeText={setPayee}
          />
        </View>

        {/* 5. Submit Button */}
        <Button
          label={
            entryType === 'income'
              ? 'Save Income Entry'
              : entryType === 'transfer'
              ? 'Confirm Transfer'
              : 'Save Expense Entry'
          }
          onPress={handleSave}
          variant="primary"
          size="lg"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
