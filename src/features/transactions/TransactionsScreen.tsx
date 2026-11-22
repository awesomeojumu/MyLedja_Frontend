import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { useTheme, Button } from '../../design';
import { Toast } from '../../design/components/Toast';
import { formatNaira } from '../../money';
import { TransactionRow, type LedgerTransaction } from './TransactionRow';
import { FilterBar, type FilterPreset } from './FilterBar';
import { FloatingBulkActionBar } from './FloatingBulkActionBar';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { BulkEditSheet } from './BulkEditSheet';
import { FilterDrawerSheet, type FilterOptions } from './FilterDrawerSheet';
import { ExportTransactionsPopup } from './ExportTransactionsPopup';
import { QuickTransactionSheet } from '../dashboard/QuickTransactionSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

export function TransactionsScreen() {
  const { colors, typography, spacing, radii } = useTheme();

  // Live Database Data
  const {
    events: dbEvents,
    accounts: dbAccounts,
    categories: dbCategories,
    repo,
  } = useDatabaseData();

  // Local overrides & deletions for instant feedback
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<LedgerTransaction>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Quick Add Transaction Sheet State
  const [addTxSheetVisible, setAddTxSheetVisible] = useState(false);
  const [addTxType, setAddTxType] = useState<'expense' | 'income'>('expense');

  // Transactions mapped from database
  const transactions = useMemo(() => {
    const baseList = dbEvents.map((ev) => {
      let amount = 0n;
      for (const line of ev.lines) {
        if (line.amountMinor > 0n) amount += line.amountMinor;
      }
      const acc = dbAccounts.find((a) => a.id === ev.lines[0]?.ledgerAccountId);
      return {
        id: ev.id,
        payee: ev.payeeName || (ev.type === 'income' ? 'Income Inflow' : 'Expense Outflow'),
        category: ev.type === 'transfer' ? 'Transfers' : ev.type === 'income' ? 'Income' : 'General Expense',
        account: acc?.name || dbAccounts[0]?.name || 'Operating Account',
        date: ev.date,
        amountMinor: amount,
        type: (ev.type === 'income' ? 'income' : ev.type === 'transfer' ? 'transfer' : 'expense') as 'income' | 'expense' | 'transfer',
        isCleared: true,
      };
    });

    return baseList
      .filter((tx) => !deletedIds.has(tx.id))
      .map((tx) => (localOverrides[tx.id] ? { ...tx, ...localOverrides[tx.id] } : tx));
  }, [dbEvents, dbAccounts, deletedIds, localOverrides]);

  // Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [activePreset, setActivePreset] = useState<FilterPreset>('all');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    dateRange: 'all',
    account: 'All Accounts',
    type: 'all',
  });

  // Multi-Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sheets & Popups State
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const [bulkEditVisible, setBulkEditVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [exportPopupVisible, setExportPopupVisible] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Filter Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          tx.payee.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.account.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Preset filter
      if (activePreset === 'expense' && tx.type !== 'expense') return false;
      if (activePreset === 'income' && tx.type !== 'income') return false;
      if (activePreset === 'transfers' && tx.type !== 'transfer') return false;
      if (activePreset === 'uncategorized' && tx.category !== 'Uncategorized') return false;

      // 3. Drawer filters
      if (filterOptions.account !== 'All Accounts' && tx.account !== filterOptions.account) return false;
      if (filterOptions.type !== 'all' && tx.type !== filterOptions.type) return false;

      return true;
    });
  }, [transactions, searchQuery, activePreset, filterOptions]);

  // Dynamic Summary Metrics
  const { totalInflowMinor, totalOutflowMinor, netMinor } = useMemo(() => {
    let inflow = 0n;
    let outflow = 0n;
    for (const tx of filteredTransactions) {
      if (tx.type === 'income') inflow += tx.amountMinor;
      else if (tx.type === 'expense') outflow += tx.amountMinor;
    }
    return {
      totalInflowMinor: inflow,
      totalOutflowMinor: outflow,
      netMinor: inflow - outflow,
    };
  }, [filteredTransactions]);

  // Timeline Grouping by Date
  const groupedSections = useMemo(() => {
    const groups: { date: string; title: string; items: LedgerTransaction[]; dayTotalMinor: bigint }[] = [];
    const todayStr = new Date().toISOString().split('T')[0]!;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]!;

    for (const tx of filteredTransactions) {
      let g = groups.find((grp) => grp.date === tx.date);
      if (!g) {
        let title = tx.date;
        if (tx.date === todayStr) title = 'Today';
        else if (tx.date === yesterdayStr) title = 'Yesterday';
        else {
          try {
            const d = new Date(tx.date);
            title = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
          } catch {
            title = tx.date;
          }
        }
        g = { date: tx.date, title, items: [], dayTotalMinor: 0n };
        groups.push(g);
      }
      g.items.push(tx);
      if (tx.type === 'expense') g.dayTotalMinor += tx.amountMinor;
      else if (tx.type === 'income') g.dayTotalMinor -= tx.amountMinor;
    }
    return groups;
  }, [filteredTransactions]);

  // Select item toggle
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkCategorize = (categoryId: string, newCategory: string) => {
    repo.bulkSetCategory(Array.from(selectedIds), categoryId).catch((e: unknown) => console.warn(e));
    setLocalOverrides((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        next[id] = { ...(next[id] || {}), category: newCategory };
      });
      return next;
    });
    setToastMessage(`Categorized ${selectedIds.size} transactions to "${newCategory}"`);
    setToastVisible(true);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  // Bulk Delete Handler
  const handleBulkDelete = () => {
    const count = selectedIds.size;
    const today = new Date().toISOString().split('T')[0]!;
    if (repo) {
      repo.bulkDelete(Array.from(selectedIds), today).catch((e: unknown) => console.warn(e));
    }
    setDeletedIds((prev) => new Set([...prev, ...selectedIds]));
    setToastMessage(`Deleted ${count} transactions`);
    setToastVisible(true);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  // Single Delete Handler
  const handleDeleteSingle = (id: string) => {
    const today = new Date().toISOString().split('T')[0]!;
    if (repo) {
      repo.deleteTransaction(id, today).catch((e: unknown) => console.warn(e));
    }
    setDeletedIds((prev) => new Set([...prev, id]));
    setToastMessage('Transaction deleted');
    setToastVisible(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.inner, { padding: spacing.lg, paddingHorizontal: spacing.xl, width: '100%' }]}>
        {/* Header Row: Title & Action */}
        <View style={[styles.headerRow, { marginBottom: spacing.md }]}>
          <View>
            <Text
              style={[
                styles.pageTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.xl,
                },
              ]}
            >
              Transactions Ledger
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                marginTop: 2,
              }}
            >
              Track, organize and review all financial movements
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label="+ Income"
              variant="secondary"
              size="sm"
              onPress={() => {
                setAddTxType('income');
                setAddTxSheetVisible(true);
              }}
            />
            <Button
              label="+ Expense"
              variant="primary"
              size="sm"
              onPress={() => {
                setAddTxType('expense');
                setAddTxSheetVisible(true);
              }}
            />
          </View>
        </View>

        {/* Dynamic Summary Strip */}
        <View
          style={[
            styles.summaryStrip,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.xl,
              paddingVertical: spacing.sm + 4,
              paddingHorizontal: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.summaryCol}>
            <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.medium, fontSize: 11 }}>
              INFLOW
            </Text>
            <Text style={{ color: colors.statusSuccess, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.sm + 1, marginTop: 2 }}>
              +{formatNaira(totalInflowMinor)}
            </Text>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.summaryCol}>
            <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.medium, fontSize: 11 }}>
              OUTFLOW
            </Text>
            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.sm + 1, marginTop: 2 }}>
              -{formatNaira(totalOutflowMinor)}
            </Text>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.summaryCol}>
            <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.medium, fontSize: 11 }}>
              NET CASH
            </Text>
            <Text
              style={{
                color: netMinor >= 0n ? colors.primary : colors.statusDanger,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.sm + 1,
                marginTop: 2,
              }}
            >
              {netMinor >= 0n ? '+' : ''}{formatNaira(netMinor)}
            </Text>
          </View>
        </View>

        {/* Filter & Search Bar with All 5 Preset Tabs */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activePreset={activePreset}
          onSelectPreset={setActivePreset}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={() => {
            setIsSelectionMode((prev) => !prev);
            setSelectedIds(new Set());
          }}
          onOpenFilterDrawer={() => setFilterDrawerVisible(true)}
          onOpenExport={() => setExportPopupVisible(true)}
        />

        {/* Timeline Grouped Transactions List */}
        {groupedSections.length === 0 ? (
          <View style={[styles.emptyContainer, { paddingVertical: spacing.huge }]}>
            <View
              style={[
                styles.emptyIconCircle,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <Receipt size={28} color={colors.textTertiary} />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.md,
                },
              ]}
            >
              No transactions recorded yet
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs + 1,
                  marginTop: 4,
                  textAlign: 'center',
                },
              ]}
            >
              Log an expense or income to track your activity in this ledger.
            </Text>
            <Button
              label="+ Record First Transaction"
              variant="primary"
              size="sm"
              style={{ marginTop: spacing.md }}
              onPress={() => {
                setAddTxType('expense');
                setAddTxSheetVisible(true);
              }}
            />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            {groupedSections.map((group) => (
              <View key={group.date} style={{ marginBottom: spacing.md }}>
                {/* Date Group Header */}
                <View style={[styles.dateHeaderRow, { marginBottom: spacing.xs }]}>
                  <Text
                    style={[
                      styles.dateHeaderTitle,
                      {
                        color: colors.textSecondary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: typography.sizes.xs,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      },
                    ]}
                  >
                    {group.title}
                  </Text>
                  {group.dayTotalMinor > 0n && (
                    <Text style={{ color: colors.textTertiary, fontFamily: typography.fonts.regular, fontSize: 11 }}>
                      Spent: {formatNaira(group.dayTotalMinor)}
                    </Text>
                  )}
                </View>

                {/* Group Card Rows */}
                <View
                  style={[
                    styles.groupCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.xl,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  {group.items.map((item) => (
                    <TransactionRow
                      key={item.id}
                      transaction={item}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(item.id)}
                      privacyMode={false}
                      onPress={() => {
                        setSelectedTx(item);
                        setDetailSheetVisible(true);
                      }}
                      onToggleSelect={() => handleToggleSelect(item.id)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Floating Bulk Action Bar */}
      <FloatingBulkActionBar
        selectedCount={selectedIds.size}
        onCategorize={() => setBulkEditVisible(true)}
        onDelete={handleBulkDelete}
        onCancel={() => {
          setSelectedIds(new Set());
          setIsSelectionMode(false);
        }}
      />

      {/* Quick Add Transaction Sheet */}
      <QuickTransactionSheet
        visible={addTxSheetVisible}
        onClose={() => setAddTxSheetVisible(false)}
        type={addTxType}
        onSaved={(message) => {
          setToastMessage(message);
          setToastVisible(true);
        }}
      />

      {/* Popups & Sheets */}
      <TransactionDetailSheet
        visible={detailSheetVisible}
        onClose={() => setDetailSheetVisible(false)}
        transaction={selectedTx}
        privacyMode={false}
        onDelete={handleDeleteSingle}
      />

      <BulkEditSheet
        visible={bulkEditVisible}
        onClose={() => setBulkEditVisible(false)}
        selectedCount={selectedIds.size}
        onSelectCategory={handleBulkCategorize}
      />

      <FilterDrawerSheet
        visible={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        currentFilters={filterOptions}
        onApplyFilters={setFilterOptions}
      />

      <ExportTransactionsPopup
        visible={exportPopupVisible}
        onClose={() => setExportPopupVisible(false)}
        transactionCount={filteredTransactions.length}
        onExport={() => {
          setToastMessage('Exported transactions to CSV');
          setToastVisible(true);
        }}
      />

      {/* Toast Notification with Undo */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    letterSpacing: -0.3,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  summaryCol: {
    flex: 1,
    paddingHorizontal: 6,
  },
  summaryColSmall: {
    paddingHorizontal: 8,
    alignItems: 'flex-end',
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dateHeaderTitle: {},
  groupCard: {
    borderWidth: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {},
  emptySubtitle: {},
});
