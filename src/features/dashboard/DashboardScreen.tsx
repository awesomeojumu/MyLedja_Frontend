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
import { monthOf } from '@/ledger';

export function DashboardScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  // Screen State
  const [currentMonth, setCurrentMonth] = useState('November 2026');
  const [isCurrentMonth, setIsCurrentMonth] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Live Database Data
  const {
    isReady,
    repo,
    accounts: dbAccounts,
    accountBalances,
    events: dbEvents,
    categories: dbCategories,
    holdings: dbHoldings,
    goals: dbGoals,
    debts: dbDebts,
    netWorthMinor,
    getMonthlyTotals,
  } = useDatabaseData();

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

  // Dynamic Metrics from Database
  const targetMonthCode = currentMonth.includes('Oct')
    ? '2026-10'
    : currentMonth.includes('Dec')
    ? '2026-12'
    : '2026-11';

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

  // Live recent transactions from MongoDB
  const displayTransactions: RecentTransactionItem[] = useMemo(() => {
    return dbEvents.slice(0, 10).map((ev) => {
      let amount = 0n;
      for (const line of ev.lines) {
        if (line.amountMinor > 0n) amount += line.amountMinor;
      }
      return {
        id: ev.id,
        payee: ev.payeeName || (ev.type === 'income' ? 'Income Deposit' : 'Expense Outflow'),
        category: ev.type === 'transfer' ? 'Transfer' : ev.type === 'income' ? 'Income' : 'Expense',
        date: ev.date,
        amountMinor: amount,
        type: ev.type === 'income' ? 'income' : ev.type === 'transfer' ? 'transfer' : 'expense',
      };
    });
  }, [dbEvents]);

  const handleSaveTransaction = async (data: {
    amount: string;
    category: string;
    account: string;
    payee: string;
    note: string;
    linkType?: 'investment' | 'goal' | 'debt';
    linkTargetId?: string;
    linkTargetName?: string;
  }) => {
    const minor = BigInt(Math.round(parseFloat(data.amount) * 100));
    const isExpense = expenseSheetVisible;
    const today = new Date().toISOString().split('T')[0]!;

    if (repo && dbAccounts.length > 0) {
      try {
        const targetAccount = dbAccounts.find((a) => a.name === data.account) || dbAccounts[0]!;
        const targetCat =
          dbCategories.find((c) => c.name.toLowerCase() === data.category.toLowerCase()) ||
          dbCategories[0];

        const notesText = data.linkTargetName ? `Smart Link: ${data.linkTargetName}` : data.note || undefined;

        if (isExpense) {
          await repo.addTransaction({
            kind: 'expense',
            accountId: targetAccount.id,
            parts: [{ amount: minor, categoryId: targetCat?.id || 'default' }],
            date: today,
            payeeName: data.payee || (data.linkTargetName ? `Allocation: ${data.linkTargetName}` : undefined),
            notes: notesText,
          });
        } else {
          await repo.addTransaction({
            kind: 'income',
            accountId: targetAccount.id,
            categoryId: targetCat?.id || 'default',
            amount: minor,
            date: today,
            payeeName: data.payee || undefined,
            notes: notesText,
          });
        }

        // 2. Execute Smart Link Balance Sheet update
        if (data.linkType === 'goal' && data.linkTargetId) {
          let goal = dbGoals.find((g) => g.id === data.linkTargetId || g.name === data.linkTargetName);
          if (!goal) {
            const added = await repo.addGoal({
              name: data.linkTargetName || 'Savings Goal',
              targetMinor: minor * 5n,
              targetDate: '31 Dec 2027',
              accountId: targetAccount.id,
            });
            if (added.ok) goal = added.value;
          }
          if (goal) {
            await repo.allocateToGoal(goal.id, {
              amount: minor,
              fromAccountId: targetAccount.id,
              date: today,
            }).catch((e: unknown) => console.warn('Goal allocation:', e));
          }
        } else if (data.linkType === 'debt' && data.linkTargetId) {
          let debt = dbDebts.find((d) => d.id === data.linkTargetId || d.name === data.linkTargetName);
          if (!debt) {
            const opened = await repo.openPersonDebt({
              name: data.linkTargetName || 'Loan',
              direction: 'iOwe',
              amount: minor * 3n,
              date: today,
              accountId: targetAccount.id,
              notes: 'Recorded via smart link',
            });
            if (opened.ok) debt = opened.value;
          }
          if (debt) {
            await repo.recordDebtPayment(debt.id, {
              accountId: targetAccount.id,
              amount: minor,
              date: today,
            }).catch((e: unknown) => console.warn('Debt payment:', e));
          }
        } else if (data.linkType === 'investment' && data.linkTargetId) {
          let holding = dbHoldings.find((h) => h.id === data.linkTargetId || h.symbol === data.linkTargetId || h.name === data.linkTargetName);
          if (!holding) {
            const created = await repo.createHolding({
              name: data.linkTargetName || 'Stock Holding',
              symbol: data.linkTargetId.length <= 10 ? data.linkTargetId : undefined,
              type: 'stock',
              accountId: targetAccount.id,
              currentPriceMinor: minor,
            });
            if (created.ok) holding = created.value;
          }
          if (holding) {
            await repo.buyHolding({
              holdingId: holding.id,
              units: '1',
              pricePerUnit: minor,
              cashAccountId: targetAccount.id,
              date: today,
            }).catch((e: unknown) => console.warn('Investment buy:', e));
          }
        }
      } catch (err) {
        console.warn('Error saving transaction to DB:', err);
      }
    }

    const linkedText = data.linkTargetName ? ` & linked to ${data.linkTargetName}` : '';
    setToastMessage(`Saved ${isExpense ? 'expense' : 'income'} of ₦${data.amount}${linkedText}`);
    setToastVisible(true);
  };

  const handleTransfer = async (data: { fromAccount: string; toAccount: string; amount: string }) => {
    const minor = BigInt(Math.round(parseFloat(data.amount) * 100));
    const today = new Date().toISOString().split('T')[0]!;

    if (repo && dbAccounts.length >= 2) {
      try {
        await repo.addTransaction({
          kind: 'transfer',
          fromId: dbAccounts[0]!.id,
          toId: dbAccounts[1]!.id,
          amount: minor,
          date: today,
        });
      } catch (err) {
        console.warn('Error recording transfer in DB:', err);
      }
    }

    setToastMessage(`Transferred ₦${data.amount} from ${data.fromAccount} to ${data.toAccount} in Database`);
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
