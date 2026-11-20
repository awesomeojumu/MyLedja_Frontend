import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link2 } from 'lucide-react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Dropdown, Button } from '../../design';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY } from '../../data/categoriesTaxonomy';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

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
    linkType?: 'investment' | 'goal' | 'debt';
    linkTargetId?: string;
    linkTargetName?: string;
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
  const { colors, typography, spacing, radii } = useTheme();
  const {
    getExpenseOptions,
    getIncomeOptions,
    getSubcategoriesForExpense,
    getSubcategoriesForIncome,
  } = useCategoryPreferences();

  // Live Database Lists for Smart Linking
  const {
    holdings: dbHoldings,
    goals: dbGoals,
    debts: dbDebts,
    accounts: dbAccounts,
  } = useDatabaseData();

  const accountOptions = useMemo(() => {
    if (dbAccounts.length > 0) {
      return dbAccounts.map((a) => a.name);
    }
    return DEFAULT_ACCOUNTS;
  }, [dbAccounts]);

  const expenseOptions = useMemo(() => getExpenseOptions(), [getExpenseOptions]);
  const incomeOptions = useMemo(() => getIncomeOptions(), [getIncomeOptions]);

  const categoryOptions = type === 'income' ? incomeOptions : expenseOptions;

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('GTBank (Current)');
  const [payee, setPayee] = useState('');
  const [error, setError] = useState('');

  // Smart Link Detection
  const isSavingsOrInvestment =
    selectedCategory.toLowerCase().includes('savings') ||
    selectedCategory.toLowerCase().includes('investment');

  const isDebtOrLoan =
    selectedCategory.toLowerCase().includes('obligation') ||
    selectedCategory.toLowerCase().includes('debt') ||
    selectedCategory.toLowerCase().includes('loan');

  const subLower = selectedSubcategory.toLowerCase();
  const isGoalSub =
    subLower.includes('saving') ||
    subLower.includes('emergency') ||
    subLower.includes('vault') ||
    subLower.includes('goal') ||
    subLower.includes('contribution');

  const isInvestmentSub =
    subLower.includes('stock') ||
    subLower.includes('bond') ||
    subLower.includes('fund') ||
    subLower.includes('invest') ||
    subLower.includes('real estate') ||
    subLower.includes('crypto') ||
    subLower.includes('share') ||
    subLower.includes('equity');

  const [overrideLinkType, setOverrideLinkType] = useState<'investment' | 'goal' | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');

  // Reset target when category changes
  useEffect(() => {
    setSelectedTargetId('');
    setOverrideLinkType(null);
  }, [selectedCategory, selectedSubcategory]);

  const activeLinkType: 'investment' | 'goal' | 'debt' | null = useMemo(() => {
    if (isDebtOrLoan) return 'debt';
    if (isSavingsOrInvestment) {
      if (overrideLinkType) return overrideLinkType;
      if (isGoalSub) return 'goal';
      if (isInvestmentSub) return 'investment';
      return 'investment';
    }
    return null;
  }, [isDebtOrLoan, isSavingsOrInvestment, isGoalSub, isInvestmentSub, overrideLinkType]);

  // Target options per active link type
  const targetOptions = useMemo(() => {
    if (activeLinkType === 'investment') {
      const dbList = dbHoldings.map((h) => ({
        label: `${h.name} (${h.symbol || 'Asset'})`,
        value: h.id,
      }));
      const defaults = [
        { label: 'MTN Nigeria Plc (MTNN)', value: 'MTNN' },
        { label: 'Guaranty Trust Holding (GTCO)', value: 'GTCO' },
        { label: 'Airtel Africa Plc (AIRTELAFRI)', value: 'AIRTELAFRI' },
        { label: 'Vanguard S&P 500 (VOO)', value: 'VOO' },
      ].filter((d) => !dbList.some((existing) => existing.value === d.value));

      return [
        { label: 'None (Record as General Expense)', value: '' },
        ...dbList,
        ...defaults,
      ];
    }

    if (activeLinkType === 'goal') {
      const dbList = dbGoals.map((g) => ({
        label: g.name,
        value: g.id,
      }));
      const defaults = [
        { label: 'Emergency Fund Vault (6 Months)', value: 'g-emergency' },
        { label: 'Annual Apartment Rent Advance', value: 'g-rent' },
        { label: 'MacBook Pro Workstation', value: 'g-macbook' },
      ].filter((d) => !dbList.some((existing) => existing.value === d.value));

      return [
        { label: 'None (Record as General Expense)', value: '' },
        ...dbList,
        ...defaults,
      ];
    }

    if (activeLinkType === 'debt') {
      const dbList = dbDebts.map((d) => ({
        label: `${d.name} (${d.direction === 'owedToMe' ? 'Lent' : 'Borrowed'})`,
        value: d.id,
      }));
      const defaults = [
        { label: 'Stanbic Quick Credit', value: 'd-stanbic' },
        { label: 'Tunde Alabi (Colleague)', value: 'd-tunde' },
        { label: 'Amina Bello (Sister)', value: 'd-amina' },
      ].filter((d) => !dbList.some((existing) => existing.value === d.value));

      return [
        { label: 'None (Record as General Expense)', value: '' },
        ...dbList,
        ...defaults,
      ];
    }

    return [];
  }, [activeLinkType, dbHoldings, dbGoals, dbDebts]);

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

    const chosenTarget = targetOptions.find((t) => t.value === selectedTargetId);

    onSave({
      amount,
      category: finalCategory || (type === 'income' ? 'Employment' : 'Food'),
      account: selectedAccount || accountOptions[0] || 'GTBank (Current)',
      payee: payee.trim(),
      note: '',
      linkType: selectedTargetId ? (activeLinkType ?? undefined) : undefined,
      linkTargetId: selectedTargetId || undefined,
      linkTargetName: chosenTarget && chosenTarget.value ? chosenTarget.label : undefined,
    });
    // Reset and close
    setAmount('');
    setPayee('');
    setSelectedSubcategory('');
    setSelectedTargetId('');
    setOverrideLinkType(null);
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
          options={accountOptions}
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

        {/* Step 4b: Smart Link Target for Investments, Savings Goals, or Debts */}
        {activeLinkType && (
          <View
            style={[
              styles.smartLinkCard,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.sm,
                marginTop: spacing.sm + 2,
              },
            ]}
          >
            {/* Header info & switcher */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Link2 size={13} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {activeLinkType === 'investment'
                    ? 'Smart Link: Investment Asset'
                    : activeLinkType === 'goal'
                    ? 'Smart Link: Savings Goal'
                    : 'Smart Link: Debt / Loan Repayment'}
                </Text>
              </View>

              {/* If Savings & Investments, allow 1-tap switcher between Investment and Goal */}
              {isSavingsOrInvestment && (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setOverrideLinkType('investment');
                      setSelectedTargetId('');
                    }}
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor:
                        activeLinkType === 'investment' ? colors.primary : colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: typography.fonts.medium,
                        color:
                          activeLinkType === 'investment' ? '#fff' : colors.textSecondary,
                      }}
                    >
                      Investment
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setOverrideLinkType('goal');
                      setSelectedTargetId('');
                    }}
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor:
                        activeLinkType === 'goal' ? colors.primary : colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: typography.fonts.medium,
                        color: activeLinkType === 'goal' ? '#fff' : colors.textSecondary,
                      }}
                    >
                      Savings Goal
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Dropdown
              label={
                activeLinkType === 'investment'
                  ? 'Target Portfolio Holding'
                  : activeLinkType === 'goal'
                  ? 'Target Savings Goal'
                  : 'Target Debt to Repay'
              }
              value={selectedTargetId}
              options={targetOptions}
              onSelect={setSelectedTargetId}
            />
          </View>
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
  smartLinkCard: {
    borderWidth: 1,
  },
});
