import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  User,
  Building,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { RecordDebtSheet, type AddedDebt } from './RecordDebtSheet';
import { QuickRepaymentSheet } from './QuickRepaymentSheet';

interface DebtItemUI {
  id: string;
  type: 'lent' | 'borrowed';
  person: string;
  originalMinor: bigint;
  remainingMinor: bigint;
  dueDate?: string;
  notes?: string;
}

export function DebtsScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'lent' | 'borrowed'>('lent');

  // State
  const [debts, setDebts] = useState<DebtItemUI[]>([
    {
      id: 'd-1',
      type: 'lent',
      person: 'Tunde Alabi (Colleague)',
      originalMinor: 5000000n,
      remainingMinor: 2500000n,
      dueDate: '30 Nov 2026',
      notes: 'Car maintenance loan',
    },
    {
      id: 'd-2',
      type: 'lent',
      person: 'Amina Bello (Sister)',
      originalMinor: 10000000n,
      remainingMinor: 10000000n,
      dueDate: '15 Dec 2026',
      notes: 'University tuition support',
    },
    {
      id: 'd-3',
      type: 'borrowed',
      person: 'Stanbic Quick Credit',
      originalMinor: 30000000n,
      remainingMinor: 12000000n,
      dueDate: '25 Nov 2026',
      notes: 'Monthly deduction at 2.5% rate',
    },
  ]);

  // Sheets
  const [recordSheetVisible, setRecordSheetVisible] = useState(false);
  const [repayingDebt, setRepayingDebt] = useState<DebtItemUI | null>(null);

  // Totals
  const totalLentMinor = debts
    .filter((d) => d.type === 'lent')
    .reduce((sum, d) => sum + d.remainingMinor, 0n);

  const totalBorrowedMinor = debts
    .filter((d) => d.type === 'borrowed')
    .reduce((sum, d) => sum + d.remainingMinor, 0n);

  const netDebtMinor = totalLentMinor - totalBorrowedMinor;

  const handleAddDebt = (newDebt: AddedDebt) => {
    setDebts((prev) => [
      ...prev,
      {
        id: newDebt.id,
        type: newDebt.type,
        person: newDebt.person,
        originalMinor: newDebt.amountMinor,
        remainingMinor: newDebt.amountMinor,
        dueDate: newDebt.dueDate,
        notes: newDebt.notes,
      },
    ]);
  };

  const handleRecordRepayment = (amountMinor: bigint) => {
    if (!repayingDebt) return;
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id === repayingDebt.id) {
          const nextRemaining = d.remainingMinor - amountMinor;
          return {
            ...d,
            remainingMinor: nextRemaining > 0n ? nextRemaining : 0n,
          };
        }
        return d;
      })
    );
  };

  const filteredDebts = debts.filter((d) => d.type === activeTab);

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
            Debts & Lending
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Receivables & Borrowed Money
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setRecordSheetVisible(true)}
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
            Record Debt
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Net Debt Position Card */}
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
            Net Debt Position
          </Text>
          <Text
            style={{
              color: netDebtMinor >= 0n ? colors.statusSuccess : colors.statusDanger,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {netDebtMinor >= 0n ? '+' : ''}
            {formatNaira(netDebtMinor)}
          </Text>

          {/* Breakdown Row */}
          <View
            style={[
              styles.statRow,
              {
                borderTopColor: colors.borderSubtle,
                marginTop: spacing.md,
                paddingTop: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
              },
            ]}
          >
            <View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.regular,
                }}
              >
                Money Lent (People owe you)
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.body,
                  marginTop: 2,
                }}
              >
                {formatNaira(totalLentMinor)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.regular,
                }}
              >
                Money Borrowed (You owe)
              </Text>
              <Text
                style={{
                  color: colors.statusWarning,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.body,
                  marginTop: 2,
                }}
              >
                {formatNaira(totalBorrowedMinor)}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: 3,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('lent')}
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === 'lent' ? colors.surface : 'transparent',
                borderRadius: radii.full,
                paddingVertical: 6,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'lent' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Money I Lent ({debts.filter((d) => d.type === 'lent').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('borrowed')}
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === 'borrowed' ? colors.surface : 'transparent',
                borderRadius: radii.full,
                paddingVertical: 6,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'borrowed' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Money I Borrowed ({debts.filter((d) => d.type === 'borrowed').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Debt Cards */}
        {filteredDebts.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => router.push(`/debts/${item.id}` as any)}
            style={[
              styles.debtCard,
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
                  styles.iconWrap,
                  {
                    backgroundColor:
                      item.type === 'lent' ? colors.primaryLight : colors.surfaceSubtle,
                    borderRadius: radii.full,
                  },
                ]}
              >
                {item.type === 'lent' ? (
                  <ArrowDownLeft size={18} color={colors.primary} />
                ) : (
                  <ArrowUpRight size={18} color={colors.textSecondary} />
                )}
              </View>

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {item.person}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.regular,
                  }}
                >
                  {item.dueDate ? `Due ${item.dueDate}` : 'No due date'}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    color: item.type === 'lent' ? colors.primary : colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {formatNaira(item.remainingMinor)}
                </Text>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontSize: 10,
                  }}
                >
                  of {formatNaira(item.originalMinor)}
                </Text>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} style={{ marginLeft: 6 }} />
            </View>

            <View
              style={{
                borderTopColor: colors.borderSubtle,
                borderTopWidth: StyleSheet.hairlineWidth,
                marginTop: spacing.md,
                paddingTop: spacing.xs,
                flexDirection: 'row',
                justifyContent: 'flex-end',
              }}
            >
              <TouchableOpacity
                onPress={() => setRepayingDebt(item)}
                style={[
                  styles.repayBtn,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    fontFamily: typography.fonts.semiBold,
                  }}
                >
                  {item.type === 'lent' ? 'Received Repayment' : 'Make Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sheets */}
      <RecordDebtSheet
        visible={recordSheetVisible}
        onClose={() => setRecordSheetVisible(false)}
        onSave={handleAddDebt}
      />

      {repayingDebt && (
        <QuickRepaymentSheet
          visible={Boolean(repayingDebt)}
          onClose={() => setRepayingDebt(null)}
          debtPerson={repayingDebt.person}
          remainingMinor={repayingDebt.remainingMinor}
          type={repayingDebt.type}
          onRecordRepayment={handleRecordRepayment}
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
  statRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabBtn: {},
  debtCard: {
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repayBtn: {},
});
