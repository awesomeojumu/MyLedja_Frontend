import React, { useState } from 'react';
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
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { AddBillSheet, type AddedBill } from './AddBillSheet';
import { MarkPaidSheet } from './MarkPaidSheet';
import { RecurringSuggestionsPopup } from './RecurringSuggestionsPopup';

interface PlanBillUI {
  id: string;
  name: string;
  amountMinor: bigint;
  dueDay: number;
  cadence: 'monthly' | 'quarterly' | 'annual';
  category: string;
  paid: boolean;
}

export function PlanScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // State
  const [bills, setBills] = useState<PlanBillUI[]>([
    {
      id: 'b-1',
      name: 'Ikeja Electric Prepaid Token',
      amountMinor: 2500000n,
      dueDay: 5,
      cadence: 'monthly',
      category: 'Utilities',
      paid: true,
    },
    {
      id: 'b-2',
      name: 'Spectranet Unlimited Fiber Internet',
      amountMinor: 2200000n,
      dueDay: 18,
      cadence: 'monthly',
      category: 'Utilities',
      paid: false,
    },
    {
      id: 'b-3',
      name: 'Apple Music Family & iCloud',
      amountMinor: 140000n,
      dueDay: 22,
      cadence: 'monthly',
      category: 'Subscriptions',
      paid: false,
    },
    {
      id: 'b-4',
      name: 'Estate Security & Maintenance Levy',
      amountMinor: 1500000n,
      dueDay: 28,
      cadence: 'monthly',
      category: 'Housing',
      paid: false,
    },
  ]);

  // Sheets
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [suggestSheetVisible, setSuggestSheetVisible] = useState(false);
  const [payingBill, setPayingBill] = useState<PlanBillUI | null>(null);

  // Totals
  const totalDueMinor = bills.reduce((sum, b) => sum + b.amountMinor, 0n);
  const paidMinor = bills.filter((b) => b.paid).reduce((sum, b) => sum + b.amountMinor, 0n);
  const unpaidMinor = totalDueMinor - paidMinor;

  const handleAddBill = (b: AddedBill) => {
    setBills((prev) => [
      ...prev,
      {
        ...b,
        paid: false,
      },
    ]);
  };

  const handleConfirmPaid = (billId: string) => {
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, paid: true } : b))
    );
  };

  const handleUnmarkPaid = (billId: string) => {
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, paid: false } : b))
    );
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

        {/* Schedule Calendar List */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Upcoming Due Dates
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

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {bill.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.regular,
                  }}
                >
                  {bill.category} • Monthly
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
                  {formatNaira(bill.amountMinor)}
                </Text>

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
                        marginTop: 4,
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
                        marginTop: 4,
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
