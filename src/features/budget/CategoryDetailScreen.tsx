import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Target,
  ArrowRightLeft,
  Edit3,
  Plus,
  ArrowUpRight,
} from 'lucide-react-native';
import { useTheme, Button } from '../../design';
import { formatNaira } from '../../money';
import { SetTargetSheet } from './SetTargetSheet';
import { EditCategorySheet } from './EditCategorySheet';
import { DeleteCategorySheet } from './DeleteCategorySheet';
import { MoveMoneySheet } from './MoveMoneySheet';
import { QuickTransactionSheet } from '../dashboard/QuickTransactionSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface CategoryDetailScreenProps {
  categoryId: string;
}

export function CategoryDetailScreen({ categoryId }: CategoryDetailScreenProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const {
    categories: dbCategories,
    events: dbEvents,
    payees: dbPayees,
    assigns,
  } = useDatabaseData();

  const matched = dbCategories.find((c) => c.id === categoryId) || dbCategories[0];

  const [customTarget, setTargetMinor] = useState<bigint | null>(null);
  const [customName, setName] = useState<string | null>(null);
  const [customGroup, setGroup] = useState<string | null>(null);

  const name = customName ?? (matched?.name || 'Category');
  const group = customGroup ?? (matched?.group || 'Needs & Living Expenses');
  const targetMinor = customTarget ?? (matched ? (assigns.get(matched.id) ?? 0n) : 0n);

  // Real transactions from database
  const transactions = React.useMemo(() => {
    if (!matched) return [];
    const list: Array<{
      id: string;
      date: string;
      payee: string;
      amountMinor: bigint;
    }> = [];

    for (const ev of dbEvents) {
      if (ev.type !== 'expense' || ev.status !== 'posted') continue;
      const line = ev.lines.find((l) => l.ledgerAccountId === matched.id);
      if (!line) continue;
      const payee = dbPayees.find((p) => p.id === ev.payeeId);
      list.push({
        id: ev.id,
        date: ev.date,
        payee: payee?.name || ev.notes || ev.payeeName || 'Expense',
        amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
      });
    }
    return list;
  }, [matched, dbEvents, dbPayees]);

  const spentMinor = transactions.reduce((sum, tx) => sum + tx.amountMinor, 0n);

  // Sheets
  const [targetSheetVisible, setTargetSheetVisible] = useState(false);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [moveMoneyVisible, setMoveMoneyVisible] = useState(false);
  const [addTxVisible, setAddTxVisible] = useState(false);

  // Remaining
  const remainingMinor = targetMinor > spentMinor ? targetMinor - spentMinor : 0n;
  const percentSpent =
    targetMinor > 0n ? Math.min(100, Math.round((Number(spentMinor) / Number(targetMinor)) * 100)) : 0;

  const progressColor =
    percentSpent > 100
      ? colors.statusDanger
      : percentSpent > 80
      ? colors.statusWarning
      : colors.primary;

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
            {name}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {group}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setEditSheetVisible(true)}
          style={[
            styles.headerActionBtn,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: spacing.xs,
            },
          ]}
        >
          <Edit3 size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Envelope Progress Hero */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Envelope Remaining
          </Text>
          <Text
            style={{
              color: remainingMinor < 0n ? colors.statusDanger : colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(remainingMinor)}
          </Text>

          {/* Progress Bar */}
          <View
            style={[
              styles.progressBarBg,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.full,
                marginTop: spacing.md,
              },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${percentSpent}%`,
                  backgroundColor: progressColor,
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
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
              }}
            >
              Spent {formatNaira(spentMinor)} ({percentSpent}%)
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
              }}
            >
              Target {formatNaira(targetMinor)}
            </Text>
          </View>
        </View>

        {/* Quick Actions Trio */}
        <View style={[styles.actionRow, { marginBottom: spacing.xl, gap: spacing.sm }]}>
          <TouchableOpacity
            onPress={() => setTargetSheetVisible(true)}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.md,
                padding: spacing.md,
                flex: 1,
              },
            ]}
          >
            <Target size={18} color={colors.primary} />
            <Text
              style={[
                styles.actionPillText,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                },
              ]}
            >
              Set Target
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMoveMoneyVisible(true)}
            style={[
              styles.actionPill,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                flex: 1,
              },
            ]}
          >
            <ArrowRightLeft size={18} color={colors.textPrimary} />
            <Text
              style={[
                styles.actionPillText,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                },
              ]}
            >
              Move Money
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Transactions */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.md,
            }}
          >
            Envelope Activity
          </Text>
          <TouchableOpacity
            onPress={() => setAddTxVisible(true)}
            style={[
              styles.addTxBtn,
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
              Add Expense
            </Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
              }}
            >
              No expenses recorded for this category yet.
            </Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View
              key={tx.id}
              style={[
                styles.txRow,
                {
                  borderBottomColor: colors.borderSubtle,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <View
                style={[
                  styles.txIconWrap,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <ArrowUpRight size={16} color={colors.textSecondary} />
              </View>

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {tx.payee}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {tx.date}
                </Text>
              </View>

              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                -{formatNaira(tx.amountMinor)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Sheets */}
      <SetTargetSheet
        visible={targetSheetVisible}
        onClose={() => setTargetSheetVisible(false)}
        categoryName={name}
        initialTargetMinor={targetMinor}
        onSaveTarget={(t) => setTargetMinor(t)}
      />

      <EditCategorySheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        category={{ id: categoryId, name, group }}
        onSave={({ name: newName, group: newGroup }) => {
          setName(newName);
          setGroup(newGroup);
        }}
        onDeleteRequest={() => setDeleteSheetVisible(true)}
      />

      <DeleteCategorySheet
        visible={deleteSheetVisible}
        onClose={() => setDeleteSheetVisible(false)}
        categoryName={name}
        onConfirmDelete={() => router.back()}
      />

      <MoveMoneySheet
        visible={moveMoneyVisible}
        onClose={() => setMoveMoneyVisible(false)}
        envelopes={[
          {
            id: categoryId,
            name,
            group,
            plannedMinor: targetMinor,
            spentMinor,
          },
          {
            id: 'other-1',
            name: 'Emergency Fund',
            group: 'Savings',
            plannedMinor: 5000000n,
            spentMinor: 0n,
          },
        ]}
        onConfirmMove={() => setMoveMoneyVisible(false)}
      />

      <QuickTransactionSheet
        visible={addTxVisible}
        onClose={() => setAddTxVisible(false)}
        type="expense"
        defaultCategoryId={categoryId}
      />
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
  headerActionBtn: {},
  content: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
  },
  progressBarBg: {
    height: 8,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionPill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {},
  addTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
