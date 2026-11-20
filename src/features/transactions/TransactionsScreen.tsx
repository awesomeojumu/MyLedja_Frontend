import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../../design';
import { Toast } from '../../design/components/Toast';
import { TransactionRow, type LedgerTransaction } from './TransactionRow';
import { FilterBar, type FilterPreset } from './FilterBar';
import { FloatingBulkActionBar } from './FloatingBulkActionBar';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { BulkEditSheet } from './BulkEditSheet';
import { FilterDrawerSheet, type FilterOptions } from './FilterDrawerSheet';
import { ExportTransactionsPopup } from './ExportTransactionsPopup';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

const DEFAULT_TRANSACTIONS: LedgerTransaction[] = [
  {
    id: 'tx-101',
    payee: 'Shoprite Supermarket',
    category: 'Groceries',
    account: 'PremiumTrust Bank',
    date: '2026-11-16',
    amountMinor: 2450000n,
    type: 'expense',
    isCleared: true,
  },
  {
    id: 'tx-102',
    payee: 'Bolt Ride to Victoria Island',
    category: 'Transportation & Fuel',
    account: 'GTBank (Current)',
    date: '2026-11-16',
    amountMinor: 420000n,
    type: 'expense',
    isCleared: true,
  },
  {
    id: 'tx-103',
    payee: 'Freelance Design Retainer',
    category: 'Salary / Income',
    account: 'PremiumTrust Bank',
    date: '2026-11-15',
    amountMinor: 35000000n,
    type: 'income',
    isCleared: true,
  },
  {
    id: 'tx-104',
    payee: 'ATM Cash Withdrawal',
    category: 'Transfers',
    account: 'Cash Wallet',
    date: '2026-11-14',
    amountMinor: 2000000n,
    type: 'transfer',
    isCleared: true,
  },
  {
    id: 'tx-105',
    payee: 'Eko Electricity Prepaid Meter',
    category: 'Utilities & Bills',
    account: 'GTBank (Current)',
    date: '2026-11-12',
    amountMinor: 1500000n,
    type: 'expense',
    isCleared: true,
  },
  {
    id: 'tx-106',
    payee: 'Netflix Monthly Subscription',
    category: 'Entertainment',
    account: 'Access Credit Card',
    date: '2026-11-10',
    amountMinor: 520000n,
    type: 'expense',
    isCleared: true,
  },
];

export function TransactionsScreen() {
  const { colors, typography, spacing } = useTheme();

  // Live Database Data
  const {
    isReady,
    events: dbEvents,
    accounts: dbAccounts,
    categories: dbCategories,
    repo,
  } = useDatabaseData();

  // Local overrides & deletions for instant feedback
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<LedgerTransaction>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const transactions = useMemo(() => {
    const baseList = dbEvents.length > 0
      ? dbEvents.map((ev) => {
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
        })
      : DEFAULT_TRANSACTIONS;

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
      if (activePreset === 'uncategorized' && tx.category !== 'Uncategorized') return false;
      if (activePreset === 'transfers' && tx.type !== 'transfer') return false;

      // 3. Drawer filters
      if (filterOptions.account !== 'All Accounts' && tx.account !== filterOptions.account) return false;
      if (filterOptions.type !== 'all' && tx.type !== filterOptions.type) return false;

      return true;
    });
  }, [transactions, searchQuery, activePreset, filterOptions]);

  // Select item toggle
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk Categorize Handler
  const handleBulkCategorize = (newCategory: string) => {
    if (repo) {
      const cat = dbCategories.find((c) => c.name.toLowerCase() === newCategory.toLowerCase());
      if (cat) {
        repo.bulkSetCategory(Array.from(selectedIds), cat.id).catch((e: unknown) => console.warn(e));
      }
    }
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
        {/* Header Title */}
        <Text
          style={[
            styles.pageTitle,
            {
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.xl,
              marginBottom: spacing.xs,
            },
          ]}
        >
          Transactions Ledger
        </Text>

        {/* Filter & Search Bar */}
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

        {/* Transactions List */}
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => (
            <TransactionRow
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
          )}
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { paddingVertical: spacing.huge }]}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.body,
                  textAlign: 'center',
                }}
              >
                No transactions match your filters.
              </Text>
            </View>
          }
        />
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
  pageTitle: {
    letterSpacing: -0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
