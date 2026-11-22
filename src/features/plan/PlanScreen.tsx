import React, { useState, useEffect, useMemo } from 'react';
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
  Check,
} from 'lucide-react-native';
import { useTheme, useResponsive, Button } from '../../design';
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
import { resolveCategoryId } from '../categories/catalog';
import { pickAccount } from '../accounts/pickAccount';

export function PlanScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  // Live Database Hook
  const { repo, accounts, categories, recurring: dbRecurring } = useDatabaseData();

  // State
  const [localBills, setLocalBills] = useState<RecurringBillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all');

  // Sheets
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [suggestSheetVisible, setSuggestSheetVisible] = useState(false);
  const [payingBill, setPayingBill] = useState<RecurringBillItem | null>(null);

  // Load from KV storage on mount
  useEffect(() => {
    async function init() {
      const loaded = await loadBillsFromStorage();
      // Purge any legacy mock bills
      const realLoaded = loaded.filter(
        (b) =>
          !b.id.startsWith('bill-mtn') &&
          !b.id.startsWith('bill-ikeja') &&
          !b.id.startsWith('bill-apple') &&
          !b.id.startsWith('bill-estate')
      );
      setLocalBills(realLoaded);
      setLoading(false);
    }
    init();
  }, []);

  // Map live recurring bills from Database or local real entries
  const bills: RecurringBillItem[] = useMemo(() => {
    if (dbRecurring && dbRecurring.length > 0) {
      return dbRecurring.map((r) => {
        const cat = categories.find((c) => c.id === r.categoryId);
        const day = r.rule?.on || 1;
        const cadence: RecurringBillItem['cadence'] = 'monthly';
        return {
          id: r.id,
          name: r.name,
          amountMinor: BigInt(r.amountMinor || '0'),
          dueDay: day,
          cadence,
          category: cat?.name || 'Utilities',
          paid: false,
        };
      });
    }
    return localBills;
  }, [dbRecurring, categories, localBills]);

  // Filtered lists
  const unpaidBills = useMemo(() => bills.filter((b) => !b.paid), [bills]);
  const paidBills = useMemo(() => bills.filter((b) => b.paid), [bills]);

  // Totals
  const totalDueMinor = bills.reduce((sum, b) => sum + b.amountMinor, 0n);
  const paidMinor = paidBills.reduce((sum, b) => sum + b.amountMinor, 0n);
  const unpaidMinor = totalDueMinor - paidMinor;

  const handleAddBill = (b: AddedBill) => {
    const updated: RecurringBillItem[] = [
      ...localBills,
      {
        ...b,
        paid: false,
      },
    ];
    setLocalBills(updated);
    saveBillsToStorage(updated);

    const payFrom = pickAccount(accounts, 'bills');
    if (repo && payFrom) {
      const today = new Date().toISOString().slice(0, 10);
      void resolveCategoryId(repo, categories, b.category, 'expense')
        .then((categoryId) =>
          repo.addRecurring({
            kind: 'bill',
            name: b.name,
            amountMinor: b.amountMinor.toString(),
            accountId: payFrom.id,
            categoryId,
            rule: { every: 'month', on: b.dueDay || 1 },
            startDate: today,
          }),
        )
        .catch((e: unknown) => console.warn('Failed to sync schedule to DB', e));
    }
  };

  const handleConfirmPaid = (billId: string, paidFromId?: string) => {
    const updated = localBills.map((b) => (b.id === billId ? { ...b, paid: true } : b));
    setLocalBills(updated);
    saveBillsToStorage(updated);

    const bill = bills.find((b) => b.id === billId);
    const schedule = dbRecurring.find((r) => r.id === billId);
    const payFrom =
      accounts.find((a) => a.id === paidFromId && !a.archived) ??
      accounts.find((a) => a.id === schedule?.accountId && !a.archived) ??
      pickAccount(accounts, 'bills');
    if (bill && repo && payFrom) {
      const today = new Date().toISOString().slice(0, 10);
      const known = schedule?.categoryId && categories.some((c) => c.id === schedule.categoryId) ? schedule.categoryId : null;
      void (known ? Promise.resolve(known) : resolveCategoryId(repo, categories, bill.category, 'expense'))
        .then((categoryId) =>
          repo.addTransaction({
            kind: 'expense',
            accountId: payFrom.id,
            parts: [{ amount: bill.amountMinor, categoryId }],
            date: today,
            payeeName: bill.name,
            notes: `Paid recurring bill: ${bill.name} (${bill.cadence})`,
          }),
        )
        .catch((e: unknown) => console.warn('Failed to record paid bill in DB', e));
    }
  };

  const handleUnmarkPaid = (billId: string) => {
    const updated = localBills.map((b) => (b.id === billId ? { ...b, paid: false } : b));
    setLocalBills(updated);
    saveBillsToStorage(updated);
  };

  const handleDeleteBill = (billId: string) => {
    const updated = localBills.filter((b) => b.id !== billId);
    setLocalBills(updated);
    saveBillsToStorage(updated);
  };

  // Reusable bill row renderer
  const renderBillCard = (bill: RecurringBillItem) => (
    <View
      key={bill.id}
      style={[
        styles.billItem,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.md,
          padding: spacing.md,
          marginBottom: spacing.sm + 2,
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
                    paddingHorizontal: 8,
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
                    marginLeft: 3,
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
                    paddingHorizontal: 10,
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
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Mobile-only header (desktop utilizes global AppHeader) */}
      {!isDesktop && (
        <View
          style={[
            styles.mobileHeaderBar,
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
              Bills & Recurring
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
              Add
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            padding: spacing.lg,
            paddingHorizontal: isDesktop ? spacing.xl : spacing.lg,
            paddingBottom: isDesktop ? 60 : 100,
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Desktop Header Row: Title & Action Strip */}
        {isDesktop && (
          <View style={[styles.desktopHeaderRow, { marginBottom: spacing.md }]}>
            <View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.xl,
                }}
              >
                Scheduled Obligations & Subscriptions
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                  marginTop: 2,
                }}
              >
                Track upcoming due dates, recurring bills, and category integrations
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Button
                label="Suggestions"
                variant="secondary"
                size="sm"
                icon={<Sparkles size={14} color={colors.primary} />}
                onPress={() => setSuggestSheetVisible(true)}
              />
              <Button
                label="+ Add Bill"
                variant="primary"
                size="sm"
                onPress={() => setAddSheetVisible(true)}
              />
            </View>
          </View>
        )}

        {/* Month Obligations Summary */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.md,
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
              marginBottom: spacing.md,
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

        {/* Quick Filter Status Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md, alignItems: 'center' }}>
          {[
            { id: 'all' as const, label: `All (${bills.length})` },
            { id: 'unpaid' as const, label: `Pending (${unpaidBills.length})` },
            { id: 'paid' as const, label: `Paid (${paidBills.length})` },
          ].map((tab) => {
            const active = filterStatus === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFilterStatus(tab.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.full,
                  backgroundColor: active ? colors.primary : colors.surfaceSubtle,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.borderSubtle,
                }}
              >
                <Text
                  style={{
                    color: active ? '#FFFFFF' : colors.textSecondary,
                    fontFamily: active ? typography.fonts.semiBold : typography.fonts.medium,
                    fontSize: 12,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Filtered Sections */}
        {filterStatus === 'all' ? (
          <>
            {/* Section 1: Pending & Upcoming Bills */}
            {unpaidBills.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: spacing.xs,
                  }}
                >
                  Pending & Upcoming ({unpaidBills.length})
                </Text>
                {unpaidBills.map(renderBillCard)}
              </View>
            )}

            {/* Section 2: Paid This Month */}
            {paidBills.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: spacing.xs,
                  }}
                >
                  Paid This Month ({paidBills.length})
                </Text>
                {paidBills.map(renderBillCard)}
              </View>
            )}

            {bills.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.xl }]}>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 13 }}>
                  No scheduled bills yet. Tap "+ Add Bill" to record your recurring outflows.
                </Text>
              </View>
            )}
          </>
        ) : filterStatus === 'unpaid' ? (
          <>
            {unpaidBills.length > 0 ? (
              unpaidBills.map(renderBillCard)
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.xl }]}>
                <Text style={{ color: colors.statusSuccess, textAlign: 'center', fontSize: 13, fontFamily: typography.fonts.medium }}>
                  🎉 All bills paid! No pending obligations this month.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {paidBills.length > 0 ? (
              paidBills.map(renderBillCard)
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.xl }]}>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 13 }}>
                  No bills marked as paid yet this month.
                </Text>
              </View>
            )}
          </>
        )}
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
          defaultAccountId={dbRecurring.find((r) => r.id === payingBill.id)?.accountId}
          onConfirmPaid={(accountId) => {
            handleConfirmPaid(payingBill.id, accountId);
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
  mobileHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  desktopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  backBtn: {},
  screenTitle: {},
  headerIconBtn: {},
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    width: '100%',
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
  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
