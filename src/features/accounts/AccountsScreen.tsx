import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SlidersHorizontal, Check, X } from 'lucide-react-native';
import { useTheme, BottomSheet } from '../../design';
import { Toast } from '../../design/components/Toast';
import { NetAssetsHero } from './NetAssetsHero';
import { AccountCardRow, type AccountData } from './AccountCardRow';
import { AddAccountSheet } from './AddAccountSheet';
import { UpdateAssetValueSheet } from './UpdateAssetValueSheet';

export type AccountFilter =
  | 'all'
  | 'income'
  | 'operating'
  | 'bills'
  | 'emergency'
  | 'savings'
  | 'investment'
  | 'project'
  | 'liability';

const FILTER_OPTIONS: { id: AccountFilter; label: string; description?: string }[] = [
  { id: 'all', label: 'All Accounts', description: 'View all 7 purposeful accounts' },
  { id: 'income', label: 'Income Accounts', description: 'Salary, business profits & inflows' },
  { id: 'operating', label: 'Operating Accounts', description: 'Daily spending & transfers' },
  { id: 'bills', label: 'Bills Accounts', description: 'Rent, utilities & recurring obligations' },
  { id: 'emergency', label: 'Emergency Funds', description: 'Unexpected expenses & safety reserves' },
  { id: 'savings', label: 'Savings Accounts', description: 'Short- and medium-term financial goals' },
  { id: 'investment', label: 'Investment Accounts', description: 'Wealth creation & portfolio assets' },
  { id: 'project', label: 'Project Accounts', description: 'Car, house, travel & major targets' },
  { id: 'liability', label: 'Credit & Liabilities', description: 'Cards, loans & money you owe' },
];

export function AccountsScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const [privacyMode, setPrivacyMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AccountFilter>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Sheets State
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [updateValueVisible, setUpdateValueVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null);

  // 7 Purposeful Accounts Data Structure (Total Assets: ₦13,095,000 | Liabilities: ₦12,000 | Net: ₦13,083,000)
  const [accounts, setAccounts] = useState<AccountData[]>([
    {
      id: 'acc-1',
      name: 'Salary & Operating Inflows',
      institution: 'PremiumTrust Bank',
      category: 'liquid',
      type: 'income',
      balanceMinor: 85000000n, // ₦850,000.00
    },
    {
      id: 'acc-2',
      name: 'Daily Spending & Operations',
      institution: 'GTBank',
      category: 'liquid',
      type: 'operating',
      balanceMinor: 34500000n, // ₦345,000.00
    },
    {
      id: 'acc-3',
      name: 'Rent & Subscriptions',
      institution: 'Zenith Bank',
      category: 'liquid',
      type: 'bills',
      balanceMinor: 21000000n, // ₦210,000.00
    },
    {
      id: 'acc-4',
      name: 'Emergency Reserve Vault',
      institution: 'Kuda Bank',
      category: 'liquid',
      type: 'emergency',
      balanceMinor: 45000000n, // ₦450,000.00
    },
    {
      id: 'acc-5',
      name: 'Target Savings Pot',
      institution: 'Stanbic IBTC',
      category: 'liquid',
      type: 'savings',
      balanceMinor: 35000000n, // ₦350,000.00
    },
    {
      id: 'acc-6',
      name: 'Real Estate & Wealth Portfolio',
      institution: 'Risevest & Lekki Property',
      category: 'investment',
      type: 'investment',
      balanceMinor: 1050000000n, // ₦10,500,000.00
    },
    {
      id: 'acc-7',
      name: 'Annual Travel & Car Project',
      institution: 'Access Bank',
      category: 'liquid',
      type: 'project',
      balanceMinor: 39000000n, // ₦390,000.00
    },
    {
      id: 'acc-8',
      name: 'Platinum Credit Card',
      institution: 'Access Bank',
      category: 'liability',
      type: 'credit',
      balanceMinor: -1200000n, // -₦12,000.00
    },
  ]);

  // Calculations
  const { totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0n;
    let liabilities = 0n;

    for (const acc of accounts) {
      if (acc.balanceMinor >= 0n) {
        assets += acc.balanceMinor;
      } else {
        liabilities += -acc.balanceMinor;
      }
    }
    return { totalAssets: assets, totalLiabilities: liabilities };
  }, [accounts]);

  // Filtered List
  const filteredAccounts = useMemo(() => {
    if (activeFilter === 'all') return accounts;
    if (activeFilter === 'liability') {
      return accounts.filter((acc) => acc.category === 'liability' || acc.type === 'credit' || acc.type === 'loan');
    }
    return accounts.filter((acc) => acc.type === activeFilter);
  }, [accounts, activeFilter]);

  // Grouped by Purposeful Structure
  const groupedSections = useMemo(() => {
    const groups: { key: string; title: string; types: string[] }[] = [
      {
        key: 'operating_group',
        title: 'Operating & Inflows (Income, Spending, Bills)',
        types: ['income', 'operating', 'bills', 'checking', 'current', 'wallet'],
      },
      {
        key: 'reserves_group',
        title: 'Reserves & Goals (Emergency, Savings, Project)',
        types: ['emergency', 'savings', 'project'],
      },
      {
        key: 'wealth_group',
        title: 'Wealth & Investments',
        types: ['investment', 'property'],
      },
      {
        key: 'liability_group',
        title: 'Credit Cards & Liabilities',
        types: ['credit', 'loan'],
      },
    ];

    const result: { key: string; title: string; items: AccountData[] }[] = [];

    for (const g of groups) {
      const items = filteredAccounts.filter((acc) => g.types.includes(acc.type));
      if (items.length > 0) {
        result.push({ key: g.key, title: g.title, items });
      }
    }

    return result;
  }, [filteredAccounts]);

  const handleSaveAccount = (newAcc: Omit<AccountData, 'id'>) => {
    const acc: AccountData = { ...newAcc, id: `acc-${Date.now()}` };
    setAccounts((prev) => [acc, ...prev]);
    setToastMessage(`Added "${acc.name}" successfully`);
    setToastVisible(true);
  };

  const handleUpdateValue = (id: string, newBalanceMinor: bigint) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, balanceMinor: newBalanceMinor } : acc))
    );
    setToastMessage('Account value updated');
    setToastVisible(true);
  };

  const activeFilterDef = FILTER_OPTIONS.find((f) => f.id === activeFilter) ?? FILTER_OPTIONS[0]!;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingBottom: 100,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Single Integrated Net Assets Hero Card with Trend Chart */}
        <NetAssetsHero
          totalAssetsMinor={totalAssets}
          totalLiabilitiesMinor={totalLiabilities}
          privacyMode={privacyMode}
          activeFilter={activeFilter}
          onAddAccount={() => setAddSheetVisible(true)}
        />

        {/* Simplicity: All Accounts pill + Filter icon button */}
        <View style={[styles.filterBar, { marginBottom: spacing.lg }]}>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
            style={[
              styles.filterPill,
              {
                backgroundColor: activeFilter === 'all' ? colors.primaryLight : colors.primary,
                borderColor: colors.primary,
                borderRadius: radii.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 3,
                marginRight: spacing.xs + 2,
              },
            ]}
          >
            <Text
              style={{
                color: activeFilter === 'all' ? colors.primary : '#FFFFFF',
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.sm,
              }}
            >
              {activeFilterDef.label}
            </Text>
            {activeFilter !== 'all' && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setActiveFilter('all');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 6 }}
              >
                <X size={13} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
            style={[
              styles.filterIconBtn,
              {
                backgroundColor: activeFilter !== 'all' ? colors.primaryLight : colors.surfaceSubtle,
                borderColor: activeFilter !== 'all' ? colors.primary : colors.border,
                borderRadius: radii.full,
                padding: spacing.xs + 4,
              },
            ]}
          >
            <SlidersHorizontal
              size={15}
              color={activeFilter !== 'all' ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Grouped Purposeful Account Cards */}
        {groupedSections.map((sec) => (
          <View key={sec.key} style={[styles.section, { marginBottom: spacing.lg }]}>
            <Text
              style={[
                styles.sectionHeader,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                  marginBottom: spacing.xs,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                },
              ]}
            >
              {sec.title}
            </Text>

            <View
              style={[
                styles.cardContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.xl,
                },
              ]}
            >
              {sec.items.map((acc) => (
                <AccountCardRow
                  key={acc.id}
                  account={acc}
                  privacyMode={privacyMode}
                  onPress={() => {
                    if (acc.category === 'investment') {
                      setSelectedAccount(acc);
                      setUpdateValueVisible(true);
                    } else {
                      router.push(`/accounts/${acc.id}` as any);
                    }
                  }}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Filter by Purpose Modal Sheet */}
      <BottomSheet
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        title="Filter Accounts by Purpose"
        subtitle="Filter accounts by their designated financial role"
      >
        <View style={{ width: '100%', gap: 6 }}>
          {FILTER_OPTIONS.map((opt) => {
            const isSelected = activeFilter === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  setActiveFilter(opt.id);
                  setFilterModalVisible(false);
                }}
                activeOpacity={0.7}
                style={[
                  styles.filterOptionRow,
                  {
                    backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                    borderColor: isSelected ? colors.primary : colors.borderSubtle,
                    borderRadius: radii.lg,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isSelected ? colors.primary : colors.textPrimary,
                      fontFamily: isSelected ? typography.fonts.semiBold : typography.fonts.medium,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    {opt.label}
                  </Text>
                  {opt.description && (
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontFamily: typography.fonts.regular,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {opt.description}
                    </Text>
                  )}
                </View>
                {isSelected && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* Popups & Sheets */}
      <AddAccountSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onSaveAccount={handleSaveAccount}
      />

      <UpdateAssetValueSheet
        visible={updateValueVisible}
        onClose={() => setUpdateValueVisible(false)}
        account={selectedAccount}
        onUpdateValue={handleUpdateValue}
      />

      {/* Toast Notification */}
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
  scroll: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterIconBtn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionRow: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    width: '100%',
  },
  sectionHeader: {},
  cardContainer: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
