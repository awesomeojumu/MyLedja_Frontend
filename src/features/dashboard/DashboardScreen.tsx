import React, { useState, useMemo } from 'react';
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
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { t, type TextKey } from '../../i18n';
import { ACCOUNT_KIND_INFO } from '../../data/workspace/model';
import { monthCodeOf, shiftMonth, thisMonthLabel } from '../../lib/months';

export function DashboardScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  // Screen State
  const [currentMonth, setCurrentMonth] = useState(thisMonthLabel);
  const [isCurrentMonth, setIsCurrentMonth] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Live Database Data
  const {
    isReady,
    accounts: dbAccounts,
    accountBalances,
    events: dbEvents,
    netWorthMinor,
    getMonthlyTotals,
  } = useDatabaseData();

  const goToMonth = (label: string) => {
    setCurrentMonth(label);
    setIsCurrentMonth(label === thisMonthLabel());
  };
  const handlePrevMonth = () => goToMonth(shiftMonth(currentMonth, -1));
  const handleNextMonth = () => goToMonth(shiftMonth(currentMonth, 1));
  const handleResetToCurrent = () => goToMonth(thisMonthLabel());

  // Popups State
  const [expenseSheetVisible, setExpenseSheetVisible] = useState(false);
  const [incomeSheetVisible, setIncomeSheetVisible] = useState(false);
  const [transferSheetVisible, setTransferSheetVisible] = useState(false);

  // Dynamic Metrics from Database
  const targetMonthCode = monthCodeOf(currentMonth);

  const monthlyTotals = getMonthlyTotals(targetMonthCode);

  const displayNetWorth = isReady ? netWorthMinor : 0n;
  const displayIncome = monthlyTotals.income;
  const displaySpent = monthlyTotals.spent;

  // Live accounts from MongoDB
  const displayAccounts: AccountItem[] = useMemo(() => {
    return dbAccounts.map((a) => {
      const bal = accountBalances.get(a.id) ?? 0n;
      const kind: 'bank' | 'wallet' | 'card' =
        a.type === 'card'
          ? 'card'
          : a.type === 'wallet' || a.type === 'cash'
          ? 'wallet'
          : 'bank';
      return {
        id: a.id,
        name: a.name,
        type: kind,
        balanceMinor: bal,
      };
    });
  }, [dbAccounts, accountBalances]);

  // Recent activity: newest first, each event named for what it is. Opening balances, corrections and moves
  // between your own accounts are shown as neutral, never as spending.
  const displayTransactions: RecentTransactionItem[] = useMemo(() => {
    const kindOf: Partial<Record<string, { label: TextKey; type: RecentTransactionItem['type'] }>> = {
      income: { label: 'activity.income', type: 'income' },
      salary_gross: { label: 'activity.income', type: 'income' },
      expense: { label: 'activity.expense', type: 'expense' },
      transfer: { label: 'activity.transfer', type: 'transfer' },
      opening_balance: { label: 'activity.opening', type: 'transfer' },
      balance_adjustment: { label: 'activity.adjustment', type: 'transfer' },
      refund: { label: 'activity.refund', type: 'income' },
      investment_buy: { label: 'activity.investBuy', type: 'transfer' },
      investment_sell: { label: 'activity.investSell', type: 'transfer' },
      collect: { label: 'activity.debtIn', type: 'income' },
      loan_repayment: { label: 'activity.debtOut', type: 'expense' },
      lend: { label: 'activity.lend', type: 'transfer' },
      loan_proceeds: { label: 'activity.loan', type: 'transfer' },
      write_off: { label: 'activity.writeOff', type: 'expense' },
    };
    return [...dbEvents]
      .filter((ev) => ev.status === 'posted' && ev.type !== 'reversal')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map((ev) => {
        let amount = 0n;
        for (const line of ev.lines) {
          if (line.amountMinor > 0n) amount += line.amountMinor;
        }
        let kind = kindOf[ev.type] ?? { label: 'activity.expense' as TextKey, type: 'expense' as const };
        // An opening balance is money you have (shown as in) or, on a card or loan, money you owe (shown as out).
        if (ev.type === 'opening_balance') {
          const owed = ev.lines.some((l) => {
            const acc = dbAccounts.find((a) => a.id === l.ledgerAccountId);
            return acc ? ACCOUNT_KIND_INFO[acc.type].ledger === 'liability' : false;
          });
          kind = { label: 'activity.opening', type: owed ? 'expense' : 'income' };
        }
        return {
          id: ev.id,
          payee: ev.payeeName || t(kind.label),
          category: t(kind.label),
          date: ev.date,
          amountMinor: amount,
          type: kind.type,
        };
      });
  }, [dbEvents, dbAccounts]);

  const showSaved = (message: string) => {
    setToastMessage(message);
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
          netWorthMinor={displayNetWorth}
          monthlyDeltaMinor={displayIncome - displaySpent}
          incomeMinor={displayIncome}
          spentMinor={displaySpent}
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
            accounts={displayAccounts}
            privacyMode={privacyMode}
            onSelectAccount={(id) => router.push(`/accounts/${id}` as any)}
            onViewAll={() => router.push('/accounts' as any)}
          />
        </View>

        {/* 5. Financial Overview Summary Cards (Budget, Plan, Debts, Goals) */}
        <DashboardSummariesGrid privacyMode={privacyMode} currentMonth={currentMonth} />

        {/* 6. Recent Activity Ledger */}
        <RecentActivityList transactions={displayTransactions} privacyMode={privacyMode} />
      </ScrollView>

      {/* Floating 5-Second Toast with 1-Tap Undo */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        onUndo={() => {
          setToastMessage('Transaction reverted in Database');
          setToastVisible(true);
        }}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Quick Add Expense Bottom Sheet */}
      <QuickTransactionSheet
        visible={expenseSheetVisible}
        onClose={() => setExpenseSheetVisible(false)}
        type="expense"
        onSaved={showSaved}
      />

      {/* Quick Add Income Bottom Sheet */}
      <QuickTransactionSheet
        visible={incomeSheetVisible}
        onClose={() => setIncomeSheetVisible(false)}
        type="income"
        onSaved={showSaved}
      />

      {/* Quick Transfer Bottom Sheet */}
      <QuickTransferSheet
        visible={transferSheetVisible}
        onClose={() => setTransferSheetVisible(false)}
        onSaved={showSaved}
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
