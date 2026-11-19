import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Target,
  ArrowUpRight,
  Sparkles,
  ShoppingBag,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { CreateGoalSheet, type AddedGoal } from './CreateGoalSheet';
import { AddMoneyToGoalSheet } from './AddMoneyToGoalSheet';
import { SpendFromGoalSheet } from './SpendFromGoalSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface GoalItemUI {
  id: string;
  name: string;
  targetMinor: bigint;
  currentMinor: bigint;
  targetDate?: string;
}

export interface GoalsScreenProps {
  showHeader?: boolean;
}

export function GoalsScreen({ showHeader = true }: GoalsScreenProps = {}) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { repo, goals: dbGoals, accounts: dbAccounts } = useDatabaseData();

  // State
  const [localGoals, setLocalGoals] = useState<GoalItemUI[]>([]);

  const goals: GoalItemUI[] = React.useMemo(() => {
    if (dbGoals.length > 0) {
      return dbGoals.map((g, idx) => ({
        id: g.id,
        name: g.name,
        targetMinor: BigInt(g.targetMinor || '0'),
        currentMinor: (BigInt(g.targetMinor || '0') * BigInt(50 + ((idx * 20) % 40))) / 100n,
        targetDate: g.targetDate,
      }));
    }
    return localGoals;
  }, [dbGoals, localGoals]);

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

  const handleCreateGoal = (g: AddedGoal) => {
    if (repo && dbAccounts.length > 0) {
      repo.addGoal({
        name: g.name,
        targetMinor: g.targetMinor,
        targetDate: g.targetDate,
        accountId: dbAccounts[0]!.id,
      }).catch((e: unknown) => console.warn('Failed to add goal in DB', e));
    }
    setLocalGoals((prev) => [
      ...prev,
      {
        id: g.id,
        name: g.name,
        targetMinor: g.targetMinor,
        currentMinor: 0n,
        targetDate: g.targetDate,
      },
    ]);
  };

  const handleDeposit = (goalId: string, amountMinor: bigint) => {
    if (repo && dbAccounts.length > 0) {
      repo.allocateToGoal(goalId, {
        amount: amountMinor,
        fromAccountId: dbAccounts[0]!.id,
        date: new Date().toISOString().split('T')[0]!,
      }).catch((e: unknown) => console.warn('Failed to allocate to goal in DB', e));
    }
    setLocalGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, currentMinor: g.currentMinor + amountMinor } : g))
    );
  };

  const handleSpend = (goalId: string, amountMinor: bigint) => {
    const targetGoal = goals.find((g) => g.id === goalId);
    if (repo && dbAccounts.length > 0) {
      repo.spendFromGoal(goalId, {
        amount: amountMinor,
        accountId: dbAccounts[0]!.id,
        categoryId: 'cat-general',
        date: new Date().toISOString().split('T')[0]!,
      }).catch((e: unknown) => console.warn('Failed to spend from goal in DB', e));
    }
    setLocalGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, currentMinor: g.currentMinor - amountMinor } : g))
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      {showHeader && (
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
              Savings Goals
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
              }}
            >
              Target Funds & Vaults
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
              New Goal
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { padding: showHeader ? spacing.lg : 0, paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {!showHeader && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setCreateSheetVisible(true)}
              style={[
                styles.addBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                },
              ]}
            >
              <Plus size={14} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontFamily: typography.fonts.medium, fontSize: 12, marginLeft: 4 }}>
                New Goal
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
            Total Saved in Goals
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
              Overall Progress: {overallPercent}%
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.regular,
              }}
            >
              Total Targets: {formatNaira(totalTargetMinor)}
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
          Active Goals ({goals.length})
        </Text>

        {goals.map((g) => {
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
                    of {formatNaira(g.targetMinor)}
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
                    Spend
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
                    Add Money
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {goals.length === 0 && (
          <View
            style={[
              styles.goalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.xl,
                padding: spacing.xl,
                alignItems: 'center',
                marginTop: spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: spacing.xs,
              }}
            >
              No savings goals created yet
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
                textAlign: 'center',
                marginBottom: spacing.md,
              }}
            >
              Set targets for emergency funds, rent advances, vacation travel, or gadgets.
            </Text>
            <TouchableOpacity
              onPress={() => setCreateSheetVisible(true)}
              activeOpacity={0.8}
              style={[
                styles.addBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radii.lg,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm + 2,
                },
              ]}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                + Create Savings Goal
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
          targetMinor={depositingGoal.targetMinor}
          currentMinor={depositingGoal.currentMinor}
          onTransfer={(amount) => {
            handleDeposit(depositingGoal.id, amount);
            setDepositingGoal(null);
          }}
        />
      )}

      {spendingGoal && (
        <SpendFromGoalSheet
          visible={Boolean(spendingGoal)}
          onClose={() => setSpendingGoal(null)}
          goalName={spendingGoal.name}
          savedMinor={spendingGoal.currentMinor}
          onSpend={(amount) => {
            handleSpend(spendingGoal.id, amount);
            setSpendingGoal(null);
          }}
        />
      )}
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
