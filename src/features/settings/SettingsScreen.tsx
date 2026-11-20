import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  User,
  Moon,
  Sun,
  Shield,
  ShieldCheck,
  Fingerprint,
  Download,
  LogOut,
  Trash2,
  ChevronRight,
  Briefcase,
  Check,
  Sliders,
  Layers,
  Globe,
  Coins,
  Palette,
  Bell,
  Database,
  Key,
  Copy,
  Lock,
  RefreshCw,
  FileSpreadsheet,
  FileJson,
  Smartphone,
  Laptop,
  AlertTriangle,
  Mail,
  Calendar,
} from 'lucide-react-native';
import { useTheme, Button, TextInput } from '../../design';
import { useAuth } from '../auth/AuthProvider';
import { TwoFactorSetupSheet } from './TwoFactorSetupSheet';
import { PasskeySheet } from './PasskeySheet';
import { DeleteAccountModal } from './DeleteAccountModal';
import { CategoryPreferencesSheet } from './CategoryPreferencesSheet';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

type SettingsTab =
  | 'general'
  | 'regional'
  | 'appearance'
  | 'categories'
  | 'security'
  | 'notifications'
  | 'data';

export function SettingsScreen() {
  const { colors, typography, spacing, radii, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { enabledIncomeIds, enabledExpenseIds } = useCategoryPreferences();
  const { snapshot } = useDatabaseData();

  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Form States
  const [workspaceName, setWorkspaceName] = useState(user?.workspaceName || 'Personal Workspace');
  const [fullName, setFullName] = useState(user?.name || 'Awesome Ojumu');
  const [userEmail, setUserEmail] = useState(user?.email || 'ayobamiojumu@gmail.com');
  const [currency, setCurrency] = useState<'NGN' | 'USD' | 'GBP' | 'EUR'>('NGN');
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'>('DD/MM/YYYY');
  const [uiDensity, setUiDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [autoLockDuration, setAutoLockDuration] = useState<'5m' | '15m' | '1h' | 'never'>('15m');

  // Notification Toggles
  const [billReminders, setBillReminders] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Security States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<Array<{ name: string; enrolledAt: string }>>([
    { name: 'iPhone 15 Pro (Face ID & Secure Enclave)', enrolledAt: 'Added 12 Nov 2026' },
    { name: 'Windows Hello (Biometric TPM)', enrolledAt: 'Added 18 Nov 2026' },
  ]);

  // Sheets & Modals
  const [twoFactorVisible, setTwoFactorVisible] = useState(false);
  const [passkeyVisible, setPasskeyVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);

  // Status feedback
  const [copiedId, setCopiedId] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleCopyId = () => {
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveGeneral = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in' as any);
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: any }> = [
    { id: 'general', label: 'Workspace', icon: Briefcase },
    { id: 'regional', label: 'Currency & Format', icon: Globe },
    { id: 'appearance', label: 'Theme & Display', icon: Palette },
    { id: 'categories', label: 'Categories', icon: Sliders },
    { id: 'security', label: 'Security & Access', icon: ShieldCheck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data & Backup', icon: Database },
  ];

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
            Preferences & Settings
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Workspace configuration, security, regional preferences & data management
          </Text>
        </View>
      </View>

      {/* Horizontal Segmented Navigation Tabs */}
      <View
        style={[
          styles.tabsRow,
          {
            borderBottomColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
        >
          {tabs.map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabPill,
                  {
                    backgroundColor: isActive ? colors.primaryLight : 'transparent',
                    borderColor: isActive ? colors.primary : 'transparent',
                    borderWidth: 1,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 7,
                    flexDirection: 'row',
                    alignItems: 'center',
                  },
                ]}
              >
                <IconComp
                  size={15}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={{
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontFamily: isActive ? typography.fonts.semiBold : typography.fonts.medium,
                    fontSize: typography.sizes.xs,
                    marginLeft: 6,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* =========================================================================
            TAB 1: WORKSPACE & PROFILE
        ========================================================================== */}
        {activeTab === 'general' && (
          <View>
            {/* User Profile Card */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Account Owner Profile
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
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
                    style={{
                      color: colors.primary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: 18,
                    }}
                  >
                    AO
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: typography.sizes.md,
                      }}
                    >
                      {fullName}
                    </Text>
                    <View
                      style={[
                        styles.rolePill,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderRadius: radii.full,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          marginLeft: 8,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.primary, fontSize: 10, fontFamily: typography.fonts.semiBold }}>
                        Workspace Owner
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      fontFamily: typography.fonts.regular,
                      marginTop: 2,
                    }}
                  >
                    {userEmail} • Connected via Google Auth
                  </Text>
                </View>
              </View>

              <View style={{ gap: 14 }}>
                <TextInput
                  label="Display Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  leftElement={<User size={16} color={colors.textTertiary} />}
                />
                <TextInput
                  label="Registered Email Address"
                  value={userEmail}
                  onChangeText={setUserEmail}
                  leftElement={<Mail size={16} color={colors.textTertiary} />}
                />
              </View>
            </View>

            {/* Workspace Organization Details */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Workspace Details
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <TextInput
                label="Workspace Legal Name"
                value={workspaceName}
                onChangeText={setWorkspaceName}
                leftElement={<Briefcase size={16} color={colors.textTertiary} />}
              />

              <View
                style={[
                  styles.workspaceIdRow,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    marginTop: spacing.md,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  },
                ]}
              >
                <View>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: typography.fonts.medium }}>
                    WORKSPACE IDENTIFIER
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: 13, marginTop: 2 }}>
                    ws_live_094821a7c4e
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCopyId}
                  style={[
                    styles.copyBtn,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radii.sm,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 5,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderColor: colors.borderSubtle,
                      borderWidth: 1,
                    },
                  ]}
                >
                  {copiedId ? (
                    <>
                      <Check size={13} color={colors.statusSuccess} />
                      <Text style={{ color: colors.statusSuccess, fontSize: 11, marginLeft: 4 }}>Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={13} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 4 }}>Copy ID</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                {savedSuccess && (
                  <Text style={{ color: colors.statusSuccess, fontSize: 12, marginRight: spacing.md, fontFamily: typography.fonts.medium }}>
                    ✓ Settings saved successfully
                  </Text>
                )}
                <Button
                  label="Save Workspace Changes"
                  onPress={handleSaveGeneral}
                  variant="primary"
                  size="md"
                />
              </View>
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 2: REGIONAL & CURRENCY PREFERENCES
        ========================================================================== */}
        {activeTab === 'regional' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Primary Ledger Currency
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.bodySm, marginBottom: spacing.md }}>
                Choose the base currency for consolidated Net Worth, Budget envelopes, and statutory reports.
              </Text>

              <View style={{ gap: 10 }}>
                {(
                  [
                    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (NGN)', desc: 'Primary Domestic Ledger Currency' },
                    { code: 'USD', symbol: '$', name: 'US Dollar (USD)', desc: 'Domiciliary & International Holdings' },
                    { code: 'GBP', symbol: '£', name: 'British Pound (GBP)', desc: 'Offshore & Foreign Accounts' },
                    { code: 'EUR', symbol: '€', name: 'Euro (EUR)', desc: 'Eurozone Inflows & Portfolios' },
                  ] as const
                ).map((c) => {
                  const isSelected = currency === c.code;
                  return (
                    <TouchableOpacity
                      key={c.code}
                      onPress={() => setCurrency(c.code)}
                      style={[
                        styles.currencyOption,
                        {
                          backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.borderSubtle,
                          borderWidth: 1,
                          borderRadius: radii.lg,
                          padding: spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={[
                            styles.currSymbolCircle,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surface,
                              borderRadius: radii.full,
                              width: 32,
                              height: 32,
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: isSelected ? '#FFFFFF' : colors.textPrimary,
                              fontFamily: typography.fonts.semiBold,
                              fontSize: 14,
                            }}
                          >
                            {c.symbol}
                          </Text>
                        </View>
                        <View style={{ marginLeft: spacing.md }}>
                          <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                            {c.name}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                            {c.desc}
                          </Text>
                        </View>
                      </View>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Date Format */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Date & Calendar Formatting
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'] as const).map((fmt) => {
                  const isSelected = dateFormat === fmt;
                  return (
                    <TouchableOpacity
                      key={fmt}
                      onPress={() => setDateFormat(fmt)}
                      style={[
                        styles.formatBtn,
                        {
                          backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.borderSubtle,
                          borderWidth: 1,
                          borderRadius: radii.md,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          flex: 1,
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isSelected ? colors.primary : colors.textPrimary,
                          fontFamily: typography.fonts.medium,
                          fontSize: 12,
                        }}
                      >
                        {fmt}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }}>
                        {fmt === 'DD/MM/YYYY' ? 'Standard (NG/UK)' : fmt === 'YYYY-MM-DD' ? 'ISO 8601' : 'US Format'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 3: THEME & DISPLAY
        ========================================================================== */}
        {activeTab === 'appearance' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Color Theme
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Light Theme Card */}
                <TouchableOpacity
                  onPress={() => {
                    if (isDark) toggleTheme();
                  }}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: !isDark ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: !isDark ? colors.primary : colors.borderSubtle,
                      borderWidth: 2,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      flex: 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Sun size={24} color={!isDark ? colors.primary : colors.textSecondary} />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                      marginTop: 8,
                    }}
                  >
                    Pure White
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                    High contrast daylight theme
                  </Text>
                </TouchableOpacity>

                {/* Dark Theme Card */}
                <TouchableOpacity
                  onPress={() => {
                    if (!isDark) toggleTheme();
                  }}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: isDark ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: isDark ? colors.primary : colors.borderSubtle,
                      borderWidth: 2,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      flex: 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Moon size={24} color={isDark ? colors.primary : colors.textSecondary} />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                      marginTop: 8,
                    }}
                  >
                    Midnight Slate
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                    Deep navy eye protection
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* UI Density */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Interface Density
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(
                  [
                    { id: 'comfortable', title: 'Comfortable', desc: 'Standard padding and generous touch targets' },
                    { id: 'compact', title: 'High Density', desc: 'Compact rows for high-volume ledger transactions' },
                  ] as const
                ).map((d) => {
                  const isSelected = uiDensity === d.id;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => setUiDensity(d.id)}
                      style={[
                        styles.densityCard,
                        {
                          backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.borderSubtle,
                          borderWidth: 1,
                          borderRadius: radii.lg,
                          padding: spacing.md,
                          flex: 1,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                        {d.title}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                        {d.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 4: CATEGORIES & TAXONOMIES
        ========================================================================== */}
        {activeTab === 'categories' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Transaction Category Taxonomies
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                      width: 40,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <Sliders size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md }}>
                    Personalized Dropdown Manager
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 }}>
                    Tailor which income streams, expense envelopes, and subcategories appear across your ledger forms.
                  </Text>
                </View>
              </View>

              {/* Active counts summary */}
              <View
                style={[
                  styles.countSummaryRow,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    marginBottom: spacing.lg,
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                  },
                ]}
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: 20 }}>
                    {enabledIncomeIds.length}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    Income Streams
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.borderSubtle }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: 20 }}>
                    {enabledExpenseIds.length}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    Expense Envelopes
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.borderSubtle }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.statusSuccess, fontFamily: typography.fonts.semiBold, fontSize: 20 }}>
                    140+
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    Subcategories
                  </Text>
                </View>
              </View>

              <Button
                label="Open Category Customizer"
                onPress={() => setCategorySheetVisible(true)}
                variant="primary"
                size="md"
                icon={<Sliders size={16} color="#FFFFFF" />}
              />
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 5: SECURITY & ACCESS
        ========================================================================== */}
        {activeTab === 'security' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Two-Factor Authentication (2FA)
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.md }}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: twoFactorEnabled ? colors.statusSuccessLight : colors.surfaceSubtle,
                        borderRadius: radii.full,
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <Shield size={18} color={twoFactorEnabled ? colors.statusSuccess : colors.textSecondary} />
                  </View>
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                      Authenticator App Verification
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 1 }}>
                      {twoFactorEnabled ? 'Active • Requires 6-digit TOTP code on login' : 'Disabled • Protect against unauthorized access'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={twoFactorEnabled}
                  onValueChange={(val) => {
                    if (val) setTwoFactorVisible(true);
                    else setTwoFactorEnabled(false);
                  }}
                  trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                />
              </View>
            </View>

            {/* Passkeys */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              FIDO2 Biometric Passkeys
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                  Registered Hardware Tokens
                </Text>
                <TouchableOpacity
                  onPress={() => setPasskeyVisible(true)}
                  style={[
                    styles.addBtn,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                    },
                  ]}
                >
                  <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: 11 }}>
                    + Register Device
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8 }}>
                {passkeys.map((p, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.passkeyRow,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderRadius: radii.md,
                        padding: spacing.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Fingerprint size={20} color={colors.primary} />
                      <View style={{ marginLeft: spacing.md }}>
                        <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }}>
                          {p.name}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>
                          {p.enrolledAt}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.activeBadge,
                        {
                          backgroundColor: colors.statusSuccessLight,
                          borderRadius: radii.full,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.statusSuccess, fontSize: 10, fontFamily: typography.fonts.semiBold }}>
                        Hardware Verified
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Auto Lock Timeout */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Session Security & Auto-Lock
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.bodySm, marginBottom: spacing.md }}>
                Automatically protect and lock your workspace ledger after periods of inactivity.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(
                  [
                    { id: '5m', label: '5 Minutes' },
                    { id: '15m', label: '15 Minutes' },
                    { id: '1h', label: '1 Hour' },
                    { id: 'never', label: 'Never' },
                  ] as const
                ).map((t) => {
                  const isSelected = autoLockDuration === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setAutoLockDuration(t.id)}
                      style={[
                        styles.autoLockBtn,
                        {
                          backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.borderSubtle,
                          borderWidth: 1,
                          borderRadius: radii.md,
                          paddingVertical: 8,
                          flex: 1,
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isSelected ? colors.primary : colors.textPrimary,
                          fontFamily: typography.fonts.medium,
                          fontSize: 12,
                        }}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 6: NOTIFICATIONS & ALERTS
        ========================================================================== */}
        {activeTab === 'notifications' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Financial Alerts & Notifications
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ gap: 16 }}>
                {/* Bill Reminders */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                      Upcoming Bill Due Reminders
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 1 }}>
                      Receive proactive notifications 3 days and 1 day prior to scheduled subscription renewals.
                    </Text>
                  </View>
                  <Switch
                    value={billReminders}
                    onValueChange={setBillReminders}
                    trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                  />
                </View>

                <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />

                {/* Budget Alerts */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                      Envelope Limit Threshold Warnings
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 1 }}>
                      Alert when any category envelope exceeds 80% or 100% of planned monthly allocation.
                    </Text>
                  </View>
                  <Switch
                    value={budgetAlerts}
                    onValueChange={setBudgetAlerts}
                    trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                  />
                </View>

                <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />

                {/* Weekly Digest */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                      Weekly Executive Cash Flow Digest
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 1 }}>
                      Automated weekly summary of net cash retained, top spenders, and portfolio variance.
                    </Text>
                  </View>
                  <Switch
                    value={weeklyDigest}
                    onValueChange={setWeeklyDigest}
                    trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 7: DATA MANAGEMENT & DANGER ZONE
        ========================================================================== */}
        {activeTab === 'data' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Portability & Ledger Backups
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.bodySm, marginBottom: spacing.md }}>
                Download your complete unencrypted financial records anytime. Fully compliant with open financial data standards.
              </Text>

              <View style={{ gap: 10 }}>
                {/* CSV */}
                <TouchableOpacity
                  style={[
                    styles.exportOption,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.borderSubtle,
                      borderWidth: 1,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FileSpreadsheet size={22} color={colors.primary} />
                    <View style={{ marginLeft: spacing.md }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                        Export Ledger Transactions (CSV)
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                        Compatible with Microsoft Excel, Google Sheets, and Apple Numbers
                      </Text>
                    </View>
                  </View>
                  <Download size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* JSON */}
                <TouchableOpacity
                  style={[
                    styles.exportOption,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.borderSubtle,
                      borderWidth: 1,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FileJson size={22} color={colors.primary} />
                    <View style={{ marginLeft: spacing.md }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                        Export Complete Workspace Snapshot (JSON)
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                        Includes accounts, budget envelopes, rules, and money events
                      </Text>
                    </View>
                  </View>
                  <Download size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Session Management & Sign Out */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Session Management
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <Laptop size={20} color={colors.textPrimary} />
                <View style={{ marginLeft: spacing.md }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }}>
                    Current Browser Session
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                    Active • Chrome on Windows • Last active just now
                  </Text>
                </View>
              </View>

              <Button
                label="Sign Out of MyLedja"
                onPress={handleSignOut}
                variant="secondary"
                size="md"
                icon={<LogOut size={16} color={colors.textPrimary} />}
              />
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionHeading, { color: colors.statusDanger }]}>
              Danger Zone
            </Text>
            <View
              style={[
                styles.dangerCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.statusDanger,
                  borderWidth: 1,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <AlertTriangle size={20} color={colors.statusDanger} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={{ color: colors.statusDanger, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                    Irreversible Account & Workspace Deletion
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2, lineHeight: 18 }}>
                    Deleting your account permanently erases your workspace, encrypted local SQLite database, and all transaction history. This action cannot be reversed.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDeleteModalVisible(true)}
                    style={[
                      styles.deleteActionBtn,
                      {
                        backgroundColor: colors.statusDangerLight,
                        borderColor: colors.statusDanger,
                        borderWidth: 1,
                        borderRadius: radii.md,
                        paddingVertical: 8,
                        paddingHorizontal: spacing.md,
                        marginTop: spacing.md,
                        alignSelf: 'flex-start',
                        flexDirection: 'row',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Trash2 size={14} color={colors.statusDanger} />
                    <Text style={{ color: colors.statusDanger, fontFamily: typography.fonts.semiBold, fontSize: 12, marginLeft: 6 }}>
                      Delete Account & Workspace
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sheets & Modals */}
      <TwoFactorSetupSheet
        visible={twoFactorVisible}
        onClose={() => setTwoFactorVisible(false)}
        onConfirm={() => {
          setTwoFactorEnabled(true);
        }}
      />

      <PasskeySheet
        visible={passkeyVisible}
        onClose={() => setPasskeyVisible(false)}
        onEnrolled={(name) => {
          setPasskeys((prev) => [
            ...prev,
            { name, enrolledAt: `Added ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` },
          ]);
        }}
      />

      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirmDelete={async () => {
          await signOut();
          router.replace('/sign-in' as any);
        }}
      />

      <CategoryPreferencesSheet
        visible={categorySheetVisible}
        onClose={() => setCategorySheetVisible(false)}
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
  tabsRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabPill: {},
  content: {
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
  },
  avatarBadge: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePill: {},
  workspaceIdRow: {},
  copyBtn: {},
  currencyOption: {},
  currSymbolCircle: {},
  formatBtn: {},
  themeCard: {},
  densityCard: {},
  iconCircle: {},
  countSummaryRow: {},
  addBtn: {},
  passkeyRow: {},
  activeBadge: {},
  autoLockBtn: {},
  exportOption: {},
  dangerCard: {},
  deleteActionBtn: {},
});
