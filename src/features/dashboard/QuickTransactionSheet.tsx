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
  const { spacing } = useTheme();
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

        {/* Step 2: Category Dropdown (Context-aware for Income vs Expense) */}
        <Dropdown
          label={type === 'income' ? 'Income Category' : 'Expense Category'}
          value={selectedCategory}
          options={categoryOptions}
          onSelect={(cat) => {
            setSelectedCategory(cat);
            setSelectedSubcategory('');
          }}
          containerStyle={{ marginTop: spacing.md }}
        />

        {/* Step 2b: Optional Subcategory Dropdown */}
        {subcategoryOptions.length > 0 && (
          <Dropdown
            label="Subcategory (Optional)"
            value={selectedSubcategory}
            options={subcategoryOptions}
            onSelect={setSelectedSubcategory}
            containerStyle={{ marginTop: spacing.md }}
          />
        )}

        {/* Step 3: Account Dropdown */}
        <Dropdown
          label={type === 'expense' ? 'Paid via Account' : 'Deposit into Account'}
          value={selectedAccount}
          options={DEFAULT_ACCOUNTS}
          onSelect={setSelectedAccount}
          containerStyle={{ marginTop: spacing.md }}
        />

        {/* Optional Payee / Source */}
        <TextInput
          label={type === 'income' ? 'Payer / Source (Optional)' : 'Payee / Merchant (Optional)'}
          placeholder={type === 'income' ? 'e.g. Employer, Client, Tenant' : 'e.g. Bolt, Shoprite, Netflix'}
          value={payee}
          onChangeText={setPayee}
          containerStyle={{ marginTop: spacing.md }}
        />

        {/* Step 4: Save & Finish */}
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={type === 'expense' ? 'Save Expense' : 'Save Income'}
            onPress={handleSave}
            variant="primary"
            size="lg"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
