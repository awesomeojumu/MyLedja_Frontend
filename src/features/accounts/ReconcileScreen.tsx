import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Plus,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme, Button, CurrencyInput } from '../../design';
import { formatNaira, parseAmount } from '../../money';
import { DiscrepancyAdjustmentSheet } from './DiscrepancyAdjustmentSheet';
import { AddMissingTransactionSheet } from './AddMissingTransactionSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface ReconcileItem {
  id: string;
  date: string;
  payee: string;
  amountMinor: bigint;
  type: 'inflow' | 'outflow';
  cleared: boolean;
}

interface ReconcileScreenProps {
  accountId: string;
}

export function ReconcileScreen({ accountId }: ReconcileScreenProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts: dbAccounts, events: dbEvents, payees: dbPayees, accountBalances } = useDatabaseData();

  const matchedAccount = dbAccounts.find((a) => a.id === accountId) || dbAccounts[0];
  const currentBal = matchedAccount ? (accountBalances.get(matchedAccount.id) ?? 0n) : 0n;

  const nativeTopInset = Platform.select({
    ios: insets.top,
    android: Math.max(insets.top, StatusBar.currentHeight ?? 0),
    default: insets.top,
  });
  const topPadding = Math.max(nativeTopInset, 16) + (nativeTopInset > 0 ? 6 : 8);

  // State
  const [statementText, setStatementText] = useState('');
  const [items, setItems] = useState<ReconcileItem[]>(() => {
    if (!matchedAccount) return [];
    const list: ReconcileItem[] = [];
    for (const ev of dbEvents) {
      const line = ev.lines.find((l) => l.ledgerAccountId === matchedAccount.id);
      if (!line) continue;
      const isOutflow = ev.type === 'expense' || line.amountMinor < 0n;
      const payee = dbPayees.find((p) => p.id === ev.payeeId);
      list.push({
        id: ev.id,
        date: ev.date,
        payee: payee?.name || ev.notes || ev.payeeName || (isOutflow ? 'Expense' : 'Income'),
        amountMinor: line.amountMinor < 0n ? -line.amountMinor : line.amountMinor,
        type: isOutflow ? 'outflow' : 'inflow',
        cleared: ev.status === 'posted',
      });
    }
    return list;
  });

  // Sheets
  const [discrepancyVisible, setDiscrepancyVisible] = useState(false);
  const [missingVisible, setMissingVisible] = useState(false);

  // Math
  const parsedStatement = parseAmount(statementText);
  const statementMinor = parsedStatement.ok ? parsedStatement.minor : 0n;

  const clearedInflows = items
    .filter((i) => i.cleared && i.type === 'inflow')
    .reduce((sum, i) => sum + i.amountMinor, 0n);

  const clearedOutflows = items
    .filter((i) => i.cleared && i.type === 'outflow')
    .reduce((sum, i) => sum + i.amountMinor, 0n);

  // Live cleared ledger balance
  const clearedTotalMinor = currentBal;
  const differenceMinor = statementMinor - clearedTotalMinor;
  const isBalanced = differenceMinor === 0n;

  const toggleCleared = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, cleared: !item.cleared } : item))
    );
  };

  const handleFinish = () => {
    if (isBalanced) {
      router.back();
    } else {
      setDiscrepancyVisible(true);
    }
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
            paddingTop: topPadding,
            paddingBottom: spacing.md,
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
            Reconcile Account
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            GTBank Main Salary
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Statement Ending Balance */}
        <View
          style={[
            styles.statementCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <CurrencyInput
            label="Bank Statement Closing Balance"
            value={statementText}
            onChangeText={setStatementText}
          />
        </View>

        {/* Live Reconciliation HUD */}
        <View
          style={[
            styles.hudCard,
            {
              backgroundColor: isBalanced ? colors.statusSuccessLight : colors.surfaceSubtle,
              borderColor: isBalanced ? colors.statusSuccess : colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            },
          ]}
        >
          <View style={styles.hudRow}>
            <View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.medium,
                }}
              >
                STATEMENT BALANCE
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.sizes.body,
                  fontFamily: typography.fonts.semiBold,
                  marginTop: 2,
                }}
              >
                {formatNaira(statementMinor)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.medium,
                }}
              >
                CLEARED BALANCE
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.sizes.body,
                  fontFamily: typography.fonts.semiBold,
                  marginTop: 2,
                }}
              >
                {formatNaira(clearedTotalMinor)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.diffBanner,
              {
                borderTopColor: colors.borderSubtle,
                marginTop: spacing.md,
                paddingTop: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isBalanced ? (
                <ShieldCheck size={18} color={colors.statusSuccess} />
              ) : (
                <AlertTriangle size={18} color={colors.statusWarning} />
              )}
              <Text
                style={{
                  color: isBalanced ? colors.statusSuccess : colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                  marginLeft: spacing.xs,
                }}
              >
                {isBalanced ? 'Balanced!' : 'Difference'}
              </Text>
            </View>
            <Text
              style={{
                color: isBalanced ? colors.statusSuccess : colors.statusDanger,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
              }}
            >
              {formatNaira(differenceMinor)}
            </Text>
          </View>
        </View>

        {/* Transactions to Tick */}
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
            Match Transactions
          </Text>
          <TouchableOpacity
            onPress={() => setMissingVisible(true)}
            style={[
              styles.missingBtn,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
              },
            ]}
          >
            <Plus size={14} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontSize: 12,
                fontFamily: typography.fonts.semiBold,
                marginLeft: 4,
              }}
            >
              Add Missing
            </Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
              }}
            >
              No ledger transactions found to reconcile for this account.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => toggleCleared(item.id)}
              style={[
                styles.itemRow,
                {
                  borderBottomColor: colors.borderSubtle,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              {item.cleared ? (
                <CheckCircle2 size={22} color={colors.primary} />
              ) : (
                <Circle size={22} color={colors.textTertiary} />
              )}

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {item.payee}
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
                  color: item.type === 'inflow' ? colors.statusSuccess : colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                {item.type === 'inflow' ? '+' : '-'}
                {formatNaira(item.amountMinor)}
              </Text>
            </TouchableOpacity>
          ))
        )}

        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={isBalanced ? 'Finish & Lock Reconciliation' : 'Finish with Adjustment'}
            onPress={handleFinish}
            variant="primary"
            size="lg"
          />
        </View>
      </ScrollView>

      {/* Popups */}
      <DiscrepancyAdjustmentSheet
        visible={discrepancyVisible}
        onClose={() => setDiscrepancyVisible(false)}
        discrepancyMinor={differenceMinor}
        onConfirmAdjustment={() => router.back()}
      />

      <AddMissingTransactionSheet
        visible={missingVisible}
        onClose={() => setMissingVisible(false)}
        onAdd={(tx) => {
          setItems((prev) => [
            {
              id: `miss-${Date.now()}`,
              date: 'Today',
              payee: tx.payee,
              amountMinor: tx.amountMinor,
              type: tx.type,
              cleared: true,
            },
            ...prev,
          ]);
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
  content: {
    paddingBottom: 40,
  },
  statementCard: {
    borderWidth: 1,
  },
  hudCard: {
    borderWidth: 1,
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diffBanner: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  missingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
