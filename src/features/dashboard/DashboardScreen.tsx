import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../design';
import { Toast } from '../../design/components/Toast';
import { MonthScopeBar } from './MonthScopeBar';
import { NetWorthHeroCard } from './NetWorthHeroCard';
import { QuickActionTrio } from './QuickActionTrio';
import { AccountsCarousel, type AccountItem } from './AccountsCarousel';
import { DashboardSummariesGrid } from './DashboardSummariesGrid';
import { RecentActivityList, type RecentTransactionItem } from './RecentActivityList';
import { QuickTransactionSheet } from './QuickTransactionSheet';
import { QuickTransferSheet } from './QuickTransferSheet';

export function DashboardScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  // Screen State
  const [currentMonth, setCurrentMonth] = useState('November 2026');
  const [isCurrentMonth, setIsCurrentMonth] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const handlePrevMonth = () => {
    setCurrentMonth('October 2026');
    setIsCurrentMonth(false);
  };

  const handleNextMonth = () => {
    setCurrentMonth('December 2026');
    setIsCurrentMonth(false);
  };

  const handleResetToCurrent = () => {
    setCurrentMonth('November 2026');
    setIsCurrentMonth(true);
  };

  // Popups State
  const [expenseSheetVisible, setExpenseSheetVisible] = useState(false);
  const [incomeSheetVisible, setIncomeSheetVisible] = useState(false);
  const [transferSheetVisible, setTransferSheetVisible] = useState(false);

  // Mock initial data (will sync with SQLite/Backend)
  const [netWorth, setNetWorth] = useState(1485020000n); // ₦14,850,200.00
  const [income, setIncome] = useState(85000000n);       // ₦850,000.00
  const [spent, setSpent] = useState(32040000n);         // ₦320,400.00

  const [accounts, setAccounts] = useState<AccountItem[]>([
    { id: '1', name: 'GTBank (Current)', type: 'bank', balanceMinor: 84500000n },
    { id: '2', name: 'Kuda Bank', type: 'wallet', balanceMinor: 21500000n },
    { id: '3', name: 'Cash Wallet', type: 'wallet', balanceMinor: 3500000n },
    { id: '4', name: 'Access Credit Card', type: 'card', balanceMinor: -1200000n },
  ]);

  const [transactions, setTransactions] = useState<RecentTransactionItem[]>([
    {
      id: 'tx-1',
      payee: 'Shoprite Supermarket',
      category: 'Groceries',
      date: 'Today, 2:15 PM',
      amountMinor: 2450000n,
      type: 'expense',
    },
    {
      id: 'tx-2',
      payee: 'Bolt Ride to Victoria Island',
      category: 'Transportation & Fuel',
      date: 'Today, 9:40 AM',
      amountMinor: 420000n,
      type: 'expense',
    },
    {
      id: 'tx-3',
      payee: 'Freelance Design Retainer',
      category: 'Salary / Income',
      date: 'Yesterday',
      amountMinor: 35000000n,
      type: 'income',
    },
  ]);

  const handleSaveTransaction = (data: {
    amount: string;
    category: string;
    account: string;
    payee: string;
    note: string;
  }) => {
    const minor = BigInt(Math.round(parseFloat(data.amount) * 100));
    const isExpense = expenseSheetVisible;

    if (isExpense) {
      setSpent((prev) => prev + minor);
      setNetWorth((prev) => prev - minor);
    } else {
      setIncome((prev) => prev + minor);
      setNetWorth((prev) => prev + minor);
    }

    const newTx: RecentTransactionItem = {
      id: `tx-${Date.now()}`,
      payee: data.payee || data.category,
      category: data.category,
      date: 'Just now',
      amountMinor: minor,
      type: isExpense ? 'expense' : 'income',
    };

    setTransactions((prev) => [newTx, ...prev]);
    setToastMessage(`Saved ${isExpense ? 'expense' : 'income'} of ₦${data.amount}`);
    setToastVisible(true);
  };

  const handleTransfer = (data: { fromAccount: string; toAccount: string; amount: string }) => {
    setToastMessage(`Transferred ₦${data.amount} from ${data.fromAccount} to ${data.toAccount}`);
    setToastVisible(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingBottom: 100,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Scope Navigator */}
        <MonthScopeBar
          currentMonth={currentMonth}
          isCurrentMonth={isCurrentMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onResetToCurrent={handleResetToCurrent}
        />

        {/* 1. Combined Net Worth & Metrics Card */}
        <NetWorthHeroCard
          netWorthMinor={netWorth}
          monthlyDeltaMinor={42000000n}
          incomeMinor={income}
          spentMinor={spent}
          currentMonth={currentMonth}
          privacyMode={privacyMode}
          onTogglePrivacy={() => setPrivacyMode((prev) => !prev)}
        />

        {/* 3. Primary Action Trio */}
        <QuickActionTrio
          onAddExpense={() => setExpenseSheetVisible(true)}
          onAddIncome={() => setIncomeSheetVisible(true)}
          onTransfer={() => setTransferSheetVisible(true)}
        />

        {/* 4. Compact Accounts Strip (No Truncation) */}
        <View style={{ marginBottom: spacing.lg }}>
          <AccountsCarousel
            accounts={accounts}
            privacyMode={privacyMode}
            onSelectAccount={(id) => router.push(`/accounts/${id}` as any)}
            onViewAll={() => router.push('/accounts' as any)}
          />
        </View>

        {/* 5. Financial Overview Summary Cards (Budget, Plan, Debts, Goals) */}
        <DashboardSummariesGrid privacyMode={privacyMode} currentMonth={currentMonth} />

        {/* 6. Recent Activity Ledger */}
        <RecentActivityList transactions={transactions} privacyMode={privacyMode} />
      </ScrollView>

      {/* Floating 5-Second Toast with 1-Tap Undo */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        onUndo={() => {
          // Reverts last transaction
          setTransactions((prev) => prev.slice(1));
          setToastMessage('Transaction undone');
          setToastVisible(true);
        }}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Quick Add Expense Bottom Sheet */}
      <QuickTransactionSheet
        visible={expenseSheetVisible}
        onClose={() => setExpenseSheetVisible(false)}
        type="expense"
        onSave={handleSaveTransaction}
      />

      {/* Quick Add Income Bottom Sheet */}
      <QuickTransactionSheet
        visible={incomeSheetVisible}
        onClose={() => setIncomeSheetVisible(false)}
        type="income"
        onSave={handleSaveTransaction}
      />

      {/* Quick Transfer Bottom Sheet */}
      <QuickTransferSheet
        visible={transferSheetVisible}
        onClose={() => setTransferSheetVisible(false)}
        onTransfer={handleTransfer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
});
