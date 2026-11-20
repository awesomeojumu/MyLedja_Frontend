import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  const [showSubcategory, setShowSubcategory] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('GTBank (Current)');
  const [payee, setPayee] = useState('');
  const [error, setError] = useState('');

  // Synchronize default category when switching between Expense and Income
  useEffect(() => {
    if (type === 'income') {
      setSelectedCategory(incomeOptions[0]?.value || 'Employment');
      setSelectedSubcategory('');
      setShowSubcategory(false);
    } else {
      setSelectedCategory(expenseOptions[0]?.value || 'Food');
      setSelectedSubcategory('');
      setShowSubcategory(false);
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
    setShowSubcategory(false);
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

        {/* Step 2: Category & Account in 2-Column Responsive Row */}
        <View style={[styles.twoColRow, { marginTop: spacing.sm }]}>
          <View style={styles.col}>
            <Dropdown
              label={type === 'income' ? 'Income Category' : 'Expense Category'}
              value={selectedCategory}
              options={categoryOptions}
              onSelect={(cat) => {
                setSelectedCategory(cat);
                setSelectedSubcategory('');
              }}
            />
          </View>

          <View style={styles.col}>
            <Dropdown
              label={type === 'expense' ? 'Paid via' : 'Deposit to'}
              value={selectedAccount}
              options={DEFAULT_ACCOUNTS}
              onSelect={setSelectedAccount}
            />
          </View>
        </View>

        {/* Optional Subcategory: Collapsed by default for a compact sheet */}
        {(showSubcategory || selectedSubcategory) && subcategoryOptions.length > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            <Dropdown
              label="Subcategory"
              value={selectedSubcategory}
              options={subcategoryOptions}
              onSelect={setSelectedSubcategory}
            />
          </View>
        ) : availableSubcategories.length > 0 ? (
          <TouchableOpacity
            onPress={() => setShowSubcategory(true)}
            style={{ alignSelf: 'flex-start', marginTop: 4, paddingVertical: 2 }}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.medium,
                fontSize: 11.5,
              }}
            >
              + Add Subcategory
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Step 3: Description / Purpose of Payment */}
        <TextInput
          label={type === 'income' ? 'Description / Income Source' : 'Purpose / Description'}
          placeholder={type === 'income' ? 'e.g. Salary, Consulting fee, Dividend' : 'e.g. MTN Data, Lunch, Fuel, Supermarket'}
          value={payee}
          onChangeText={setPayee}
          containerStyle={{ marginTop: spacing.sm }}
        />

        {/* Step 4: Save & Finish */}
        <View style={{ marginTop: spacing.md }}>
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
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
});
