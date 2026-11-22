import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Upload,
  CheckCheck,
  Edit2,
  Sparkles,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
} from 'lucide-react-native';
import { useTheme, TextInput } from '../../design';
import { formatNaira } from '../../money';
import { CSVImportSheet } from './CSVImportSheet';
import { StatementAIPopup } from './StatementAIPopup';
import { EditAccountPopup } from './EditAccountPopup';
import { QuickTransactionSheet } from '../dashboard/QuickTransactionSheet';
import { AccountBalanceChart } from './AccountBalanceChart';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

export interface AccountLedgerItem {
  id: string;
  date: string;
  payee: string;
  category: string;
  amountMinor: bigint;
  type: 'inflow' | 'outflow';
  cleared: boolean;
}

interface AccountDetailScreenProps {
  accountId: string;
}

export function AccountDetailScreen({ accountId }: AccountDetailScreenProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    accounts: dbAccounts,
    events: dbEvents,
    payees: dbPayees,
    categories: dbCategories,
    accountBalances,
  } = useDatabaseData();

  const nativeTopInset = Platform.select({
    ios: insets.top,
    android: Math.max(insets.top, StatusBar.currentHeight ?? 0),
    default: insets.top,
  });
  const topPadding = Math.max(nativeTopInset, 16) + (nativeTopInset > 0 ? 6 : 8);

  const matched = dbAccounts.find((a) => a.id === accountId) || dbAccounts[0];

  // State
  const [search, setSearch] = useState('');
  const [customName, setAccountName] = useState<string | null>(null);

  // Sheets
  const [csvSheetVisible, setCsvSheetVisible] = useState(false);
  const [aiPopupVisible, setAiPopupVisible] = useState(false);
  const [editPopupVisible, setEditPopupVisible] = useState(false);
  const [addTxVisible, setAddTxVisible] = useState(false);

  const accountName = customName ?? (matched?.name || 'Account');
  const institution = matched?.type === 'bank' || matched?.type === 'savings' ? 'Bank Account' : matched?.type || 'Account';
  const accountType = matched?.type || 'Asset';
  const baseBalanceMinor = matched ? (accountBalances.get(matched.id) ?? 0n) : 0n;
  const balanceMinor = baseBalanceMinor;
  const clearedBalanceMinor = balanceMinor;

  // Real transactions from database
  const transactions: AccountLedgerItem[] = React.useMemo(() => {
    if (!matched) return [];
    const list: AccountLedgerItem[] = [];
    for (const ev of dbEvents) {
      const line = ev.lines.find((l) => l.ledgerAccountId === matched.id);
      if (!line) continue;
      const isOutflow = ev.type === 'expense' || line.amountMinor < 0n;
      const catLine = ev.lines.find((l) => l.ledgerAccountId && l.ledgerAccountId !== matched.id);
      const cat = dbCategories.find((c) => c.id === catLine?.ledgerAccountId);
      const payee = dbPayees.find((p) => p.id === ev.payeeId);

      list.push({
        id: ev.id,
        date: ev.date,
        payee: payee?.name || ev.notes || ev.payeeName || (isOutflow ? 'Expense' : 'Income'),
        category: cat?.name || (isOutflow ? 'General Expense' : 'Income'),
        amountMinor: line.amountMinor < 0n ? -line.amountMinor : line.amountMinor,
        type: isOutflow ? 'outflow' : 'inflow',
        cleared: ev.status === 'posted',
      });
    }
    return list;
  }, [matched, dbEvents, dbCategories, dbPayees]);

  const filteredTx = transactions.filter(
    (tx) =>
      tx.payee.toLowerCase().includes(search.toLowerCase()) ||
      tx.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleImportComplete = (_count: number) => {
    // Handled by ledger sync
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
            {accountName}
          </Text>
          <Text
            style={[
              styles.accountType,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
              },
            ]}
          >
            {accountType} • {institution}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setEditPopupVisible(true)}
          style={[
            styles.headerActionBtn,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: spacing.xs,
            },
          ]}
        >
          <Edit2 size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Consolidated Compact Hero Card: Balance & Actions */}
        <View
          style={[
            styles.compactHeroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          {/* Top: Current Balance & Cleared status inline */}
          <View style={styles.compactBalanceRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Current Balance
              </Text>
              <View style={styles.amountBadgeRow}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.xxl,
                    letterSpacing: -0.5,
                  }}
                >
                  {formatNaira(balanceMinor)}
                </Text>
                <View
                  style={[
                    styles.clearedBadge,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: typography.fonts.medium,
                      fontSize: 11,
                    }}
                  >
                    Cleared: {formatNaira(clearedBalanceMinor)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom: Compact Action Trio Pills */}
          <View
            style={[
              styles.compactActionTrio,
              {
                marginTop: spacing.sm,
                paddingTop: spacing.sm,
                borderTopColor: colors.borderSubtle,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.push(`/accounts/${accountId}/reconcile` as any)}
              style={[
                styles.compactActionPill,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primaryBorder,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 5,
                },
              ]}
            >
              <CheckCheck size={13} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.medium,
                  fontSize: 12,
                  marginLeft: 4,
                }}
              >
                Reconcile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCsvSheetVisible(true)}
              style={[
                styles.compactActionPill,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 5,
                },
              ]}
            >
              <Upload size={13} color={colors.textPrimary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: 12,
                  marginLeft: 4,
                }}
              >
                Import CSV
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setAiPopupVisible(true)}
              style={[
                styles.compactActionPill,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 5,
                },
              ]}
            >
              <Sparkles size={13} color={colors.textPrimary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: 12,
                  marginLeft: 4,
                }}
              >
                Smart Reader
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive Balance Trend Chart */}
        <AccountBalanceChart
          accountId={matched?.id ?? accountId}
          currentBalanceMinor={balanceMinor}
          accountType={accountType}
        />

        {/* Account Transactions Section */}
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
            Account Activity
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
              Add Entry
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            placeholder="Search transactions..."
            value={search}
            onChangeText={setSearch}
            leftElement={<Search size={16} color={colors.textTertiary} />}
          />
        </View>

        {filteredTx.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
              }}
            >
              No transactions recorded for this account yet.
            </Text>
          </View>
        ) : (
          filteredTx.map((item) => (
            <View
              key={item.id}
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
                    backgroundColor:
                      item.type === 'inflow' ? colors.primaryLight : colors.surfaceSubtle,
                    borderRadius: radii.full,
                  },
                ]}
              >
                {item.type === 'inflow' ? (
                  <ArrowDownLeft size={16} color={colors.primary} />
                ) : (
                  <ArrowUpRight size={16} color={colors.textSecondary} />
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
                  {item.payee}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {item.date} • {item.category}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
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
                <Text
                  style={{
                    color: item.cleared ? colors.statusSuccess : colors.textTertiary,
                    fontFamily: typography.fonts.regular,
                    fontSize: 10,
                  }}
                >
                  {item.cleared ? 'Cleared' : 'Uncleared'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Sheets & Popups */}
      <CSVImportSheet
        visible={csvSheetVisible}
        onClose={() => setCsvSheetVisible(false)}
        accountName={accountName}
        onImportComplete={handleImportComplete}
      />

      <StatementAIPopup
        visible={aiPopupVisible}
        onClose={() => setAiPopupVisible(false)}
        onEnable={() => {}}
      />

      <EditAccountPopup
        visible={editPopupVisible}
        onClose={() => setEditPopupVisible(false)}
        account={{ id: accountId, name: accountName }}
        onSave={({ name }) => setAccountName(name)}
      />

      <QuickTransactionSheet
        visible={addTxVisible}
        onClose={() => setAddTxVisible(false)}
        type="expense"
        allowTypeSwitch
        defaultAccountId={accountId}
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
  accountType: {},
  headerActionBtn: {},
  content: {
    paddingBottom: 40,
  },
  compactHeroCard: {
    borderWidth: 1,
  },
  compactBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 8,
  },
  compactActionTrio: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  heroCard: {
    borderWidth: 1,
  },
  clearedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
