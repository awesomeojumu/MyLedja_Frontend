import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  MessageSquare,
  Plus,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
} from 'lucide-react-native';
import { useTheme, Button } from '../../design';
import { formatNaira } from '../../money';
import { ReminderMessageSheet } from './ReminderMessageSheet';
import { RecordInstallmentSheet } from './RecordInstallmentSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface DebtDetailScreenProps {
  debtId: string;
}

export function DebtDetailScreen({ debtId }: DebtDetailScreenProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { debts: dbDebts } = useDatabaseData();

  const matched = dbDebts.find((d) => d.id === debtId) || dbDebts[0];

  // State
  const person = matched?.name || 'Debt Contact';
  const type: 'lent' | 'borrowed' = matched?.direction === 'owedToMe' ? 'lent' : 'borrowed';
  const originalMinor = BigInt(matched?.scheduleAmountMinor || matched?.creditMinor || '0');
  const [remainingMinor, setRemainingMinor] = useState<bigint>(originalMinor);
  const dueDate = matched?.nextDueDate || 'No due date';

  // Sheets
  const [reminderVisible, setReminderVisible] = useState(false);
  const [installmentVisible, setInstallmentVisible] = useState(false);

  // Installment history
  const [history, setHistory] = useState<Array<{
    id: string;
    date: string;
    amountMinor: bigint;
    note: string;
  }>>([]);

  const repaidMinor = originalMinor - remainingMinor;
  const percentRepaid =
    originalMinor > 0n ? Math.min(100, Math.round((Number(repaidMinor) / Number(originalMinor)) * 100)) : 0;

  const handleAddInstallment = ({ amountMinor, note }: { amountMinor: bigint; note: string }) => {
    const nextRemaining = remainingMinor - amountMinor;
    setRemainingMinor(nextRemaining > 0n ? nextRemaining : 0n);
    setHistory((prev) => [
      {
        id: `inst-${Date.now()}`,
        date: 'Today',
        amountMinor,
        note,
      },
      ...prev,
    ]);
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
            {person}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {type === 'lent' ? 'Money Lent (Receivable)' : 'Money Borrowed (Liability)'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Remaining Hero Card */}
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
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Outstanding Balance
          </Text>
          <Text
            style={{
              color: remainingMinor === 0n ? colors.statusSuccess : colors.textPrimary,
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
                  width: `${percentRepaid}%`,
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
              Repaid {formatNaira(repaidMinor)} ({percentRepaid}%)
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.regular,
              }}
            >
              Principal {formatNaira(originalMinor)}
            </Text>
          </View>
        </View>

        {/* Action Trio */}
        <View style={[styles.actionRow, { marginBottom: spacing.xl, gap: spacing.sm }]}>
          <TouchableOpacity
            onPress={() => setInstallmentVisible(true)}
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
            <Plus size={18} color={colors.primary} />
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
              Record Payment
            </Text>
          </TouchableOpacity>

          {type === 'lent' && (
            <TouchableOpacity
              onPress={() => setReminderVisible(true)}
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
              <MessageSquare size={18} color={colors.textPrimary} />
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
                Send Reminder
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Installment History */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Payment Timeline
        </Text>

        {history.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
              }}
            >
              No repayment installments recorded yet.
            </Text>
          </View>
        ) : (
          history.map((item) => (
            <View
              key={item.id}
              style={[
                styles.historyRow,
                {
                  borderBottomColor: colors.borderSubtle,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <View
                style={[
                  styles.historyIcon,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <CheckCircle2 size={16} color={colors.primary} />
              </View>

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {item.note}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {item.date}
                </Text>
              </View>

              <Text
                style={{
                  color: colors.statusSuccess,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                +{formatNaira(item.amountMinor)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Sheets */}
      <ReminderMessageSheet
        visible={reminderVisible}
        onClose={() => setReminderVisible(false)}
        personName={person}
        amountMinor={remainingMinor}
        dueDate={dueDate}
      />

      <RecordInstallmentSheet
        visible={installmentVisible}
        onClose={() => setInstallmentVisible(false)}
        onAddInstallment={handleAddInstallment}
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
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
