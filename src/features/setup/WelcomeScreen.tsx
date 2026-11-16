import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Building2,
  Plus,
  Trash2,
  Check,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  CreditCard,
} from 'lucide-react-native';
import { useTheme, TextInput, Button } from '../../design';
import { useAuth } from '../auth/AuthProvider';
import { QuickBankPickerSheet, type AddedBankAccount } from './QuickBankPickerSheet';
import { formatNaira } from '../../money';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';

export function WelcomeScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { user, setSession } = useAuth();
  const {
    allIncomeCategories,
    allExpenseCategories,
    enabledIncomeIds,
    enabledExpenseIds,
    setIncomeCategories,
    setExpenseCategories,
  } = useCategoryPreferences();

  const [workspaceName, setWorkspaceName] = useState('Personal');
  const [bankAccounts, setBankAccounts] = useState<AddedBankAccount[]>([]);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState<string[]>(enabledIncomeIds);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>(enabledExpenseIds);
  const [loading, setLoading] = useState(false);

  // Sheets
  const [bankSheetVisible, setBankSheetVisible] = useState(false);

  const toggleIncome = (id: string) => {
    setSelectedIncomeIds((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id]
    );
  };

  const toggleExpense = (id: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id]
    );
  };

  const handleAddAccount = (account: AddedBankAccount) => {
    setBankAccounts((prev) => [...prev, account]);
  };

  const handleRemoveAccount = (id: string) => {
    setBankAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleFinishSetup = async () => {
    setLoading(true);
    try {
      // Save customized categories to preferences
      setIncomeCategories(selectedIncomeIds);
      setExpenseCategories(selectedExpenseIds);

      if (user) {
        await setSession({
          ...user,
          setupComplete: true,
          workspaceName: workspaceName.trim() || 'Personal',
        });
      }
      // Route to Home Dashboard
      router.replace('/' as any);
    } catch {
      // Fallback redirect
      router.replace('/' as any);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        {
          backgroundColor: colors.background,
          padding: spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, { maxWidth: 620 }]}>
        {/* Header */}
        <View style={{ marginBottom: spacing.xl }}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.full,
                alignSelf: 'flex-start',
                marginBottom: spacing.sm,
              },
            ]}
          >
            <ShieldCheck size={14} color={colors.primary} />
            <Text
              style={[
                styles.badgeText,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              QUICK SETUP
            </Text>
          </View>
          <Text
            style={[
              styles.title,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.hero,
              },
            ]}
          >
            Set up your financial workspace
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.body,
                marginTop: spacing.xs,
              },
            ]}
          >
            Customize your income streams, link initial accounts, and pick your active transaction categories.
          </Text>
        </View>

        {/* Section 1: Workspace Name & Currency */}
        <View
          style={[
            styles.sectionCard,
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
            style={[
              styles.sectionTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.lg,
                marginBottom: spacing.md,
              },
            ]}
          >
            1. Workspace Details
          </Text>

          <View style={{ marginBottom: spacing.md }}>
            <TextInput
              label="Workspace Name"
              value={workspaceName}
              onChangeText={setWorkspaceName}
              placeholder="e.g. Personal or Family"
              leftElement={<Briefcase size={18} color={colors.textTertiary} />}
            />
          </View>

          <View
            style={[
              styles.currencyRow,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
              },
            ]}
          >
            <View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.medium,
                }}
              >
                DEFAULT CURRENCY
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.sizes.body,
                  fontFamily: typography.fonts.semiBold,
                  marginTop: 2,
                }}
              >
                Nigerian Naira (₦ NGN)
              </Text>
            </View>
            <View
              style={[
                styles.curBadge,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 12,
                }}
              >
                Primary
              </Text>
            </View>
          </View>
        </View>

        {/* Section 2: Bank Accounts */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.lg,
                },
              ]}
            >
              2. Bank & Purposeful Accounts
            </Text>
            <TouchableOpacity
              onPress={() => setBankSheetVisible(true)}
              style={[
                styles.addBtn,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
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
                Add Account
              </Text>
            </TouchableOpacity>
          </View>

          {bankAccounts.length === 0 ? (
            <TouchableOpacity
              onPress={() => setBankSheetVisible(true)}
              style={[
                styles.emptyAccountsCard,
                {
                  borderColor: colors.border,
                  borderRadius: radii.md,
                },
              ]}
            >
              <Building2 size={24} color={colors.textTertiary} />
              <Text
                style={[
                  styles.emptyAccountsText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                Tap here to add your first account (PremiumTrust, GTBank, Kuda...)
              </Text>
            </TouchableOpacity>
          ) : (
            <View>
              {bankAccounts.map((acc) => (
                <View
                  key={acc.id}
                  style={[
                    styles.accountItem,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.avatarBadge,
                      {
                        backgroundColor: colors.primaryLight,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        {
                          color: colors.primary,
                          fontFamily: typography.fonts.semiBold,
                        },
                      ]}
                    >
                      {acc.initials}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: typography.fonts.medium,
                      }}
                    >
                      {acc.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: typography.sizes.sm,
                      }}
                    >
                      Opening balance: {formatNaira(acc.balanceMinor)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveAccount(acc.id)}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={16} color={colors.statusDanger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section 3: Select Your Income Streams */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TrendingUp size={18} color={colors.statusSuccess} style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.lg,
                  },
                ]}
              >
                3. Income
              </Text>
            </View>
            <View
              style={[
                styles.curBadge,
                {
                  backgroundColor: colors.statusSuccessLight,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.statusSuccess,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 11,
                }}
              >
                {selectedIncomeIds.length} Selected
              </Text>
            </View>
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.regular,
              marginBottom: spacing.md,
            }}
          >
            Choose your sources of income. Only selected streams will appear in your income dropdowns.
          </Text>

          <View style={styles.chipGrid}>
            {allIncomeCategories.map((cat) => {
              const selected = selectedIncomeIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => toggleIncome(cat.id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selected ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: selected ? colors.primary : colors.borderSubtle,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  {selected && (
                    <Check size={14} color={colors.primary} style={{ marginRight: 6 }} />
                  )}
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.textSecondary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 4: Select Your Expense Categories */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CreditCard size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.lg,
                  },
                ]}
              >
                4. Expense
              </Text>
            </View>
            <View
              style={[
                styles.curBadge,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
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
                {selectedExpenseIds.length} Selected
              </Text>
            </View>
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.regular,
              marginBottom: spacing.md,
            }}
          >
            Select the spending categories you use. You can change these anytime in Settings.
          </Text>

          <View style={styles.chipGrid}>
            {allExpenseCategories.map((cat) => {
              const selected = selectedExpenseIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => toggleExpense(cat.id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selected ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: selected ? colors.primary : colors.borderSubtle,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  {selected && (
                    <Check size={14} color={colors.primary} style={{ marginRight: 6 }} />
                  )}
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.textSecondary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CTA: Get Started */}
        <Button
          label="Get Started with MyLedja"
          onPress={handleFinishSetup}
          variant="primary"
          size="lg"
          loading={loading}
          icon={<ArrowRight size={18} color="#FFFFFF" />}
        />
      </View>

      {/* Sheets */}
      <QuickBankPickerSheet
        visible={bankSheetVisible}
        onClose={() => setBankSheetVisible(false)}
        onAddAccount={handleAddAccount}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    lineHeight: 22,
  },
  sectionCard: {
    borderWidth: 1,
  },
  sectionTitle: {},
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  curBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emptyAccountsCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAccountsText: {
    textAlign: 'center',
    fontSize: 13,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
});
