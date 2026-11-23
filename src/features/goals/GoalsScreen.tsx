import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Target,
  ShoppingBag,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { CreateGoalSheet, type NewGoal } from './CreateGoalSheet';
import { Toast } from '../../design/components/Toast';
import { t } from '../../i18n';
import { resolveCategoryId } from '../categories/catalog';
import { AddMoneyToGoalSheet } from './AddMoneyToGoalSheet';
import { SpendFromGoalSheet } from './SpendFromGoalSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface GoalItemUI {
  id: string;
  name: string;
  targetMinor: bigint;
  currentMinor: bigint;
  targetDate?: string;
  accountId: string;
  categoryId?: string;
}

export function GoalsScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { repo, goals: dbGoals, categories: dbCategories, allocations: dbAllocations } = useDatabaseData();
  const [notice, setNotice] = useState('');

  const goals: GoalItemUI[] = React.useMemo(
    () =>
      dbGoals
        .map((g) => {
          const currentSaved = dbAllocations
            .filter((a) => a.goalId === g.id)
            .reduce((sum, a) => {
              const amount = BigInt(a.amountMinor || '0');
              return a.kind === 'spend' ? sum - amount : sum + amount;
            }, 0n);
          return {
            id: g.id,
            name: g.name,
            targetMinor: BigInt(g.targetMinor || '0'),
            currentMinor: currentSaved > 0n ? currentSaved : 0n,
            targetDate: g.targetDate,
            accountId: g.accountId,
            categoryId: g.categoryId,
          };
        }),
    [dbGoals, dbAllocations],
  );

  // Sheets
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [depositingGoal, setDepositingGoal] = useState<GoalItemUI | null>(null);
  const [spendingGoal, setSpendingGoal] = useState<GoalItemUI | null>(null);

  // Totals
  const totalSavedMinor = goals.reduce((sum, g) => sum + g.currentMinor, 0n);
  const totalTargetMinor = goals.reduce((sum, g) => sum + g.targetMinor, 0n);
  const overallPercent =
    totalTargetMinor > 0n
      ? Math.min(100, Math.round((Number(totalSavedMinor) / Number(totalTargetMinor)) * 100))
      : 0;

  const today = () => new Date().toISOString().slice(0, 10);

  /** Makes the savings account and budget line when asked, then the goal kept in that account. */
  const handleCreateGoal = async (g: NewGoal): Promise<boolean> => {
    let accountId = g.accountId;
    let alreadySaved: bigint | undefined;
    if (!accountId && g.newAccount) {
      const made = await repo.addAccount({
        name: g.newAccount.name,
        type: 'savings',
        purpose: 'savings',
        openingBalance: g.newAccount.balanceMinor,
        openingDate: today(),
      });
      if (!made.ok) return false;
      accountId = made.value.id;
      // Money already sitting in a new savings account counts towards the goal kept there.
      if (g.newAccount.balanceMinor > 0n) alreadySaved = g.newAccount.balanceMinor > g.targetMinor ? g.targetMinor : g.newAccount.balanceMinor;
    }
    if (!accountId) return false;

    let categoryId: string | undefined;
    if (g.budget === 'new') {
      const existingGroup = dbCategories.find((c) => c.kind === 'expense' && c.budgetType === 'savings' && !c.deleted)?.group;
      const group = existingGroup ?? (await repo.createCategoryGroup({ name: t('goals.savingsGroup'), kind: 'expense' })).id;
      categoryId = (await repo.addCategory({ name: g.name, kind: 'expense', group, budgetType: 'savings' })).id;
    } else if (g.budget) {
      categoryId = g.budget;
    }

    const res = await repo.addGoal({
      name: g.name,
      targetMinor: g.targetMinor,
      targetDate: g.targetDate,
      accountId,
      categoryId,
      alreadySavedMinor: alreadySaved,
    });
    if (!res.ok) return false;

    // With a date and a budget line, plan this month's share in the budget.
    if (categoryId && g.targetDate) {
      const [y, m] = g.targetDate.split('-').map(Number);
      const now = new Date();
      const months = y && m ? Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth())) : 1;
      const left = g.targetMinor - (alreadySaved ?? 0n);
      if (left > 0n) await repo.setAssigned(categoryId, today().slice(0, 7), left / BigInt(months));
    }
    setNotice(t('goals.create.saved'));
    return true;
  };

  const handleDeposit = async (goalId: string, amountMinor: bigint, fromAccountId: string): Promise<boolean> => {
    const res = await repo.allocateToGoal(goalId, { amount: amountMinor, fromAccountId, date: today() });
    return res.ok;
  };

  const handleSpend = async (goal: GoalItemUI, amountMinor: bigint, payee: string) => {
    const categoryId =
      goal.categoryId && dbCategories.some((c) => c.id === goal.categoryId)
        ? goal.categoryId
        : await resolveCategoryId(repo, dbCategories, payee || goal.name, 'expense');
    const res = await repo.spendFromGoal(goal.id, {
      amount: amountMinor,
      accountId: goal.accountId,
      categoryId,
      date: today(),
      payeeName: payee.trim() || undefined,
    });
    if (!res.ok) setNotice(t('goals.spend.failed'));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.headerBar,
          {
            borderBottomColor: colors.borderSubtle,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { padding: spacing.xs }]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[
              styles.screenTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.lg,
              },
            ]}
          >
            {t('ui.goalsScreen.savingsGoals')}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {t('ui.goalsScreen.targetFundsAndVaults')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setCreateSheetVisible(true)}
          style={[
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            },
          ]}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            {t('ui.goalsScreen.newGoal')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Goals Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('ui.goalsScreen.totalSavedInGoals')}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(totalSavedMinor)}
          </Text>

          {/* Progress Track */}
          <View
            style={[
              styles.barBg,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.full,
                marginTop: spacing.md,
              },
            ]}
          >
            <View
              style={[
                styles.barFill,
                {
                  width: `${overallPercent}%`,
                  backgroundColor: colors.primary,
                  borderRadius: radii.full,
                },
              ]}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: spacing.sm,
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.regular,
              }}
            >
              {t('ui.goalsScreen.overallProgress')}{' '}{overallPercent}%
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.regular,
              }}
            >
              {t('ui.goalsScreen.totalTargets')}{' '}{formatNaira(totalTargetMinor)}
            </Text>
          </View>
        </View>

        {/* Goals List */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          {t('ui.goalsScreen.activeGoals')}{goals.length})
        </Text>

        {goals.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.xl,
              alignItems: 'center',
              borderWidth: 1,
            }}
          >
            <Target size={32} color={colors.textTertiary} style={{ marginBottom: spacing.sm }} />
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              {t('ui.goalsScreen.noSavingsGoalsYet')}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: 12,
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              {t('ui.goalsScreen.tapNewGoalOrAllocate')}
            </Text>
          </View>
        ) : (
          goals.map((g) => {
          const pct =
            g.targetMinor > 0n
              ? Math.min(100, Math.round((Number(g.currentMinor) / Number(g.targetMinor)) * 100))
              : 0;

          return (
            <View
              key={g.id}
              style={[
                styles.goalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={[
                    styles.goalIcon,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  <Target size={18} color={colors.primary} />
                </View>

                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.bodySm,
                    }}
                  >
                    {g.name}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      fontFamily: typography.fonts.regular,
                    }}
                  >
                    {g.targetDate ? `Target: ${g.targetDate}` : 'Open-ended'}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                    }}
                  >
                    {formatNaira(g.currentMinor)}
                  </Text>
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: 10,
                    }}
                  >
                    {t('ui.goalsScreen.of')}{' '}{formatNaira(g.targetMinor)}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View
                style={[
                  styles.barBg,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.full,
                    marginTop: spacing.md,
                  },
                ]}
              >
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: pct >= 100 ? colors.statusSuccess : colors.primary,
                      borderRadius: radii.full,
                    },
                  ]}
                />
              </View>

              {/* Action Buttons on Card */}
              <View
                style={{
                  borderTopColor: colors.borderSubtle,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  marginTop: spacing.md,
                  paddingTop: spacing.xs,
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: spacing.xs,
                }}
              >
                <TouchableOpacity
                  onPress={() => setSpendingGoal(g)}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                    },
                  ]}
                >
                  <ShoppingBag size={12} color={colors.textSecondary} />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontFamily: typography.fonts.medium,
                      marginLeft: 4,
                    }}
                  >
                    {t('ui.goalsScreen.spend')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setDepositingGoal(g)}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                    },
                  ]}
                >
                  <Plus size={12} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      fontFamily: typography.fonts.semiBold,
                      marginLeft: 4,
                    }}
                  >
                    {t('ui.goalsScreen.addMoney')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }))}
      </ScrollView>

      {/* Sheets */}
      <CreateGoalSheet
        visible={createSheetVisible}
        onClose={() => setCreateSheetVisible(false)}
        onSave={handleCreateGoal}
      />

      {depositingGoal && (
        <AddMoneyToGoalSheet
          visible={Boolean(depositingGoal)}
          onClose={() => setDepositingGoal(null)}
          goalName={depositingGoal.name}
          goalAccountId={depositingGoal.accountId}
          targetMinor={depositingGoal.targetMinor}
          currentMinor={depositingGoal.currentMinor}
          onTransfer={(amount, fromAccountId) => handleDeposit(depositingGoal.id, amount, fromAccountId)}
        />
      )}

      {spendingGoal && (
        <SpendFromGoalSheet
          visible={Boolean(spendingGoal)}
          onClose={() => setSpendingGoal(null)}
          goalName={spendingGoal.name}
          savedMinor={spendingGoal.currentMinor}
          onSpend={(amount, payee) => {
            void handleSpend(spendingGoal, amount, payee);
            setSpendingGoal(null);
          }}
        />
      )}

      <Toast visible={!!notice} message={notice} onDismiss={() => setNotice('')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {},
  screenTitle: {},
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
  },
  barBg: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  goalCard: {
    borderWidth: 1,
  },
  goalIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
