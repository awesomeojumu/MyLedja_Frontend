import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Calendar,
  Sparkles,
  Clock,
  RotateCcw,
  ArrowRight,
  Layers,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { AddBillSheet, type AddedBill } from './AddBillSheet';
import { MarkPaidSheet } from './MarkPaidSheet';
import { RecurringSuggestionsPopup } from './RecurringSuggestionsPopup';
import {
  loadBillsFromStorage,
  saveBillsToStorage,
  getMonthlyEquivalentMinor,
  type RecurringBillItem,
  DEFAULT_RECURRING_BILLS,
} from './billsModel';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

export function PlanScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { repo, accounts, categories } = useDatabaseData();

  // State
  const [bills, setBills] = useState<RecurringBillItem[]>(DEFAULT_RECURRING_BILLS);
  const [loading, setLoading] = useState(true);

  // Sheets
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [suggestSheetVisible, setSuggestSheetVisible] = useState(false);
  const [payingBill, setPayingBill] = useState<RecurringBillItem | null>(null);

  // Load from KV storage on mount
  useEffect(() => {
    async function init() {
      const loaded = await loadBillsFromStorage();
      setBills(loaded);
      setLoading(false);
    }
    init();
  }, []);

  // Totals
  const totalDueMinor = bills.reduce((sum, b) => sum + b.amountMinor, 0n);
  const paidMinor = bills.filter((b) => b.paid).reduce((sum, b) => sum + b.amountMinor, 0n);
  const unpaidMinor = totalDueMinor - paidMinor;

  const handleAddBill = (b: AddedBill) => {
    const updated: RecurringBillItem[] = [
      ...bills,
      {
        ...b,
        paid: false,
      },
    ];
    setBills(updated);
    saveBillsToStorage(updated);

    if (repo && accounts.length > 0) {
      const targetCat = categories.find((c) => c.name.toLowerCase() === b.category.toLowerCase()) || categories[0];
      repo.addRecurring({
        kind: 'bill',
        name: b.name,
        amountMinor: b.amountMinor.toString(),
        accountId: accounts[0]!.id,
        categoryId: targetCat?.id,
        rule: { every: 'month', on: b.dueDay || 1 },
        startDate: '2026-11-01',
      }).catch((e: unknown) => console.warn('Failed to sync schedule to DB', e));
    }
  };

  const handleConfirmPaid = (billId: string) => {
    const updated = bills.map((b) => (b.id === billId ? { ...b, paid: true } : b));
    setBills(updated);
    saveBillsToStorage(updated);

    const bill = bills.find((b) => b.id === billId);
    if (bill && repo && accounts.length > 0) {
      const today = new Date().toISOString().split('T')[0]!;
      const targetCat = categories.find((c) => c.name.toLowerCase() === bill.category.toLowerCase()) || categories[0];
      repo.addTransaction({
        kind: 'expense',
        accountId: accounts[0]!.id,
        parts: [{ amount: bill.amountMinor, categoryId: targetCat?.id || 'default' }],
        date: today,
        payeeName: bill.name,
        notes: `Paid recurring bill: ${bill.name} (${bill.cadence})`,
      }).catch((e: unknown) => console.warn('Failed to record paid bill in DB', e));
    }
  };

  const handleUnmarkPaid = (billId: string) => {
    const updated = bills.map((b) => (b.id === billId ? { ...b, paid: false } : b));
    setBills(updated);
    saveBillsToStorage(updated);
  };

  const handleDeleteBill = (billId: string) => {
    const updated = bills.filter((b) => b.id !== billId);
    setBills(updated);
    saveBillsToStorage(updated);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
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
            Bills & Recurring Plan
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            November 2026 Scheduled Outflows
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setSuggestSheetVisible(true)}
          style={[
            styles.headerIconBtn,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: spacing.xs,
              marginRight: spacing.xs,
            },
          ]}
        >
          <Sparkles size={16} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAddSheetVisible(true)}
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
            Add Bill
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Obligations Summary */}
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
            Remaining Bills This Month
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(unpaidMinor)}
          </Text>

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
                Total Scheduled
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.body,
                  marginTop: 2,
                }}
              >
                {formatNaira(totalDueMinor)}
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
                Paid so Far
              </Text>
              <Text
                style={{
                  color: colors.statusSuccess,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.body,
                  marginTop: 2,
                }}
              >
                {formatNaira(paidMinor)}
              </Text>
            </View>
          </View>
        </View>

        {/* Connected to Budget Banner */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/budget')}
          style={[
            styles.budgetLinkCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radii.full,
                backgroundColor: colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.sm,
              }}
            >
              <Layers size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 13,
                }}
              >
                Connected to Category Envelopes
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: 11,
                  marginTop: 1,
                }}
              >
                Bills feed directly into your /budget subcategory planned allocations
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 11.5,
                marginRight: 3,
              }}
            >
              Budget
            </Text>
            <ArrowRight size={13} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Schedule Calendar List */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Upcoming Due Dates & Subscriptions
        </Text>

        {bills.map((bill) => (
          <View
            key={bill.id}
            style={[
              styles.billItem,
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
              {/* Due Day Circle */}
              <View
                style={[
                  styles.dayBadge,
                  {
                    backgroundColor: bill.paid ? colors.statusSuccessLight : colors.primaryLight,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Text
                  style={{
                    color: bill.paid ? colors.statusSuccess : colors.primary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: 14,
                  }}
                >
                  {bill.dueDay}
                </Text>
                <Text
                  style={{
                    color: bill.paid ? colors.statusSuccess : colors.primary,
                    fontFamily: typography.fonts.medium,
                    fontSize: 10,
                  }}
                >
                  Nov
                </Text>
              </View>

              <View style={{ flex: 1, marginLeft: spacing.md, marginRight: spacing.xs }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {bill.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                  <View
                    style={{
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.xs,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ fontSize: 9.5, color: colors.textSecondary, fontFamily: typography.fonts.medium }}>
                      {bill.category}
                    </Text>
                  </View>
                  {bill.subcategory && (
                    <View
                      style={{
                        backgroundColor: colors.primaryLight,
                        borderRadius: radii.xs,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                      }}
                    >
                      <Text style={{ fontSize: 9.5, color: colors.primary, fontFamily: typography.fonts.medium }}>
                        {bill.subcategory}
                      </Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 9.5, color: colors.textTertiary, textTransform: 'capitalize' }}>
                    • {bill.cadence}
                    {bill.cadence !== 'monthly' ? ` (~${formatNaira(getMonthlyEquivalentMinor(bill))}/mo)` : ''}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', marginLeft: spacing.xs }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {formatNaira(bill.amountMinor)}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {bill.paid ? (
                    <TouchableOpacity
                      onPress={() => handleUnmarkPaid(bill.id)}
                      style={[
                        styles.paidPill,
                        {
                          backgroundColor: colors.statusSuccessLight,
                          borderRadius: radii.full,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          flexDirection: 'row',
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <CheckCircle2 size={10} color={colors.statusSuccess} />
                      <Text
                        style={{
                          color: colors.statusSuccess,
                          fontFamily: typography.fonts.medium,
                          fontSize: 10,
                          marginLeft: 2,
                        }}
                      >
                        Paid
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setPayingBill(bill)}
                      style={[
                        styles.markBtn,
                        {
                          backgroundColor: colors.primaryLight,
                          borderRadius: radii.full,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontFamily: typography.fonts.semiBold,
                          fontSize: 11,
                        }}
                      >
                        Mark Paid
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDeleteBill(bill.id)}
                    style={{ padding: 3, opacity: 0.4 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={12} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Sheets */}
      <AddBillSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onSave={handleAddBill}
      />

      {payingBill && (
        <MarkPaidSheet
          visible={Boolean(payingBill)}
          onClose={() => setPayingBill(null)}
          billName={payingBill.name}
          amountMinor={payingBill.amountMinor}
          onConfirmPaid={() => {
            handleConfirmPaid(payingBill.id);
            setPayingBill(null);
          }}
        />
      )}

      <RecurringSuggestionsPopup
        visible={suggestSheetVisible}
        onClose={() => setSuggestSheetVisible(false)}
        onAddSuggested={(suggested) => {
          handleAddBill({
            ...suggested,
            category: 'Subscriptions',
          });
          setSuggestSheetVisible(false);
        }}
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
  headerIconBtn: {},
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  budgetLinkCard: {
    borderWidth: 1,
  },
  heroCard: {
    borderWidth: 1,
  },
  statRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  billItem: {
    borderWidth: 1,
  },
  dayBadge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidPill: {},
  markBtn: {},
});
