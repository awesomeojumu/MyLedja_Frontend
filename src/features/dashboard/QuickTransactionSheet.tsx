import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Dropdown, Button } from '../../design';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY } from '../../data/categoriesTaxonomy';

export interface QuickTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  type: 'expense' | 'income';
  onSave: (transaction: {
    amount: string;
    category: string;
    account: string;
    payee: string;
    note: string;
  }) => void;
}

export const EXPENSE_CATEGORIES = EXPENSE_TAXONOMY.map((c) => c.name);
export const INCOME_CATEGORIES = INCOME_TAXONOMY.map((c) => c.name);

const DEFAULT_ACCOUNTS = ['GTBank (Current)', 'Kuda Bank', 'Cash Wallet'];

export function QuickTransactionSheet({
  visible,
  onClose,
  type,
  onSave,
}: QuickTransactionSheetProps) {
  const { colors, typography, spacing } = useTheme();
  const {
    getExpenseOptions,
    getIncomeOptions,
    getSubcategoriesForExpense,
    getSubcategoriesForIncome,
  } = useCategoryPreferences();

  const expenseOptions = useMemo(() => getExpenseOptions(), [getExpenseOptions]);
  const incomeOptions = useMemo(() => getIncomeOptions(), [getIncomeOptions]);

  const categoryOptions = type === 'income' ? incomeOptions : expenseOptions;

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('GTBank (Current)');
  const [payee, setPayee] = useState('');
  const [error, setError] = useState('');

  // Synchronize default category when switching between Expense and Income
  useEffect(() => {
    if (type === 'income') {
      setSelectedCategory(incomeOptions[0]?.value || 'Employment');
      setSelectedSubcategory('');
    } else {
      setSelectedCategory(expenseOptions[0]?.value || 'Food');
      setSelectedSubcategory('');
    }
  }, [type, visible, expenseOptions, incomeOptions]);

  // Subcategories
  const availableSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    return type === 'income'
      ? getSubcategoriesForIncome(selectedCategory)
      : getSubcategoriesForExpense(selectedCategory);
  }, [type, selectedCategory, getSubcategoriesForExpense, getSubcategoriesForIncome]);

  const subcategoryOptions = useMemo(() => {
    if (availableSubcategories.length === 0) return [];
    return [
      { label: 'None (General / Unspecified)', value: '' },
      ...availableSubcategories.map((sub) => ({ label: sub, value: sub })),
    ];
  }, [availableSubcategories]);

  const handleSave = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setError('');

    const finalCategory = selectedSubcategory
      ? `${selectedCategory}: ${selectedSubcategory}`
      : selectedCategory;

    onSave({
      amount,
      category: finalCategory || (type === 'income' ? 'Employment' : 'Food'),
      account: selectedAccount || 'GTBank (Current)',
      payee: payee.trim(),
      note: '',
    });
    // Reset and close
    setAmount('');
    setPayee('');
    setSelectedSubcategory('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={type === 'expense' ? 'Add Expense' : 'Add Income'}
    >
      <View style={styles.form}>
        {/* Step 1: Amount */}
        <CurrencyInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            if (error) setError('');
          }}
          error={error}
          placeholder="0.00"
        />

        {/* Step 2: Paid via (Account) comes BEFORE Category */}
        <Dropdown
          label={type === 'expense' ? 'Paid via' : 'Deposit into Account'}
          value={selectedAccount}
          options={DEFAULT_ACCOUNTS}
          onSelect={setSelectedAccount}
          containerStyle={{ marginTop: spacing.sm + 2 }}
        />

        {/* Step 3: Expense / Income Category */}
        <Dropdown
          label={type === 'income' ? 'Income Category' : 'Expense Category'}
          value={selectedCategory}
          options={categoryOptions}
          onSelect={(cat) => {
            setSelectedCategory(cat);
            setSelectedSubcategory('');
          }}
          containerStyle={{ marginTop: spacing.sm + 2 }}
        />

        {/* Step 4: Optional Subcategory Dropdown */}
        {subcategoryOptions.length > 0 && (
          <Dropdown
            label="Subcategory (Optional)"
            value={selectedSubcategory}
            options={subcategoryOptions}
            onSelect={setSelectedSubcategory}
            containerStyle={{ marginTop: spacing.sm + 2 }}
          />
        )}

        {/* Step 5: Description / Purpose of Payment */}
        <TextInput
          label={type === 'income' ? 'Description / Income Source' : 'Purpose / Description'}
          placeholder={type === 'income' ? 'e.g. Salary, Consulting fee, Dividend' : 'e.g. MTN Data, Lunch, Fuel, Supermarket'}
          value={payee}
          onChangeText={setPayee}
          containerStyle={{ marginTop: spacing.sm + 2 }}
        />

        {/* Step 6: Save & Finish */}
        <View style={{ marginTop: spacing.md + 2 }}>
          <Button
            label={type === 'expense' ? 'Save Expense' : 'Save Income'}
            onPress={handleSave}
            variant="primary"
            size="md"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
