import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  User,
  Moon,
  Sun,
  Shield,
  Fingerprint,
  Download,
  Trash2,
  Check,
  Sliders,
  Palette,
  Database,
  FileSpreadsheet,
  FileJson,
  AlertTriangle,
  Mail,
  KeyRound,
} from 'lucide-react-native';
import { useTheme, Button, TextInput, THEME_ACCENTS } from '../../design';
import { useAuth } from '../auth/AuthProvider';
import { TwoFactorSetupSheet } from './TwoFactorSetupSheet';
import { PasskeySheet } from './PasskeySheet';
import { ChangePasswordSheet } from './ChangePasswordSheet';
import { DeleteAccountModal } from './DeleteAccountModal';
import { CategoryPreferencesSheet } from './CategoryPreferencesSheet';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';

import { t } from '../../i18n';
type SettingsTab = 'account' | 'categories' | 'preferences' | 'data';

export function SettingsScreen() {
  const { colors, typography, spacing, radii, isDark, setThemeMode, accent, setAccent } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { user, signOut } = useAuth();
  const { enabledIncomeIds, enabledExpenseIds } = useCategoryPreferences();

  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  // Form States
  const [fullName, setFullName] = useState(user?.name || 'Awesome Ojumu');
  const [userEmail, setUserEmail] = useState(user?.email || 'ayobamiojumu@gmail.com');
  const [currency, setCurrency] = useState<'NGN' | 'USD' | 'GBP' | 'EUR'>('NGN');
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'>('DD/MM/YYYY');
  const [uiDensity, setUiDensity] = useState<'comfortable' | 'compact'>('comfortable');

  // Notification Toggles
  const [billReminders, setBillReminders] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Security States
  const [passwordSheetVisible, setPasswordSheetVisible] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<{ name: string; enrolledAt: string }[]>([]);

  // Sheets & Modals
  const [twoFactorVisible, setTwoFactorVisible] = useState(false);
  const [passkeyVisible, setPasskeyVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);

  // Status feedback
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveGeneral = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'account', label: 'Account & Security', icon: User },
    { id: 'categories', label: 'Categories', icon: Sliders },
    { id: 'preferences', label: 'Preferences', icon: Palette },
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
            {t('ui.settingsScreen.preferencesAndSettings')}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {t('ui.settingsScreen.accountSettingsSecurityRegionalPreferences')}
          </Text>
        </View>
      </View>

      {/* Body: Desktop 2-column with Settings Sidebar vs Mobile single-column */}
      <View style={[styles.bodyLayout, isDesktop ? styles.desktopBody : styles.mobileBody]}>
        {/* Settings Sidebar (Desktop) */}
        {isDesktop ? (
          <View
            style={[
              styles.settingsSidebar,
              {
                width: 250,
                borderRightColor: colors.borderSubtle,
                borderRightWidth: 1,
                backgroundColor: colors.surface,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            <View style={{ gap: 4 }}>
              {tabs.map((tab) => {
                const IconComp = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[
                      styles.sidebarItem,
                      {
                        backgroundColor: isActive ? colors.primaryLight : 'transparent',
                        borderRadius: radii.md,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconComp
                        size={17}
                        color={isActive ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={{
                          color: isActive ? colors.primary : colors.textPrimary,
                          fontFamily: isActive ? typography.fonts.semiBold : typography.fonts.medium,
                          fontSize: typography.sizes.bodySm,
                          marginLeft: 10,
                        }}
                      >
                        {tab.label}
                      </Text>
                    </View>
                    {isActive && (
                      <View
                        style={{
                          width: 3,
                          height: 16,
                          borderRadius: 2,
                          backgroundColor: colors.primary,
                        }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          /* Mobile horizontal pill strip */
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
        )}

        {/* Content Pane */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { padding: spacing.xl, maxWidth: isDesktop ? 860 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
        {/* =========================================================================
            TAB 1: ACCOUNT & SECURITY
        ========================================================================== */}
        {activeTab === 'account' && (
          <View>
            {/* User Profile Card */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.accountProfile')}
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
                    {t('ui.settingsScreen.ao')}
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
                        {t('ui.settingsScreen.accountOwner')}
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
                    {userEmail}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 14 }}>
                <TextInput
                  label={t('ui.settingsScreen.displayFullName')}
                  value={fullName}
                  onChangeText={setFullName}
                  leftElement={<User size={16} color={colors.textTertiary} />}
                />
                <TextInput
                  label={t('ui.settingsScreen.registeredEmailAddress')}
                  value={userEmail}
                  onChangeText={setUserEmail}
                  leftElement={<Mail size={16} color={colors.textTertiary} />}
                />
              </View>

              <View style={{ marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                {savedSuccess && (
                  <Text style={{ color: colors.statusSuccess, fontSize: 12, marginRight: spacing.md, fontFamily: typography.fonts.medium }}>
                    {t('ui.settingsScreen.profileUpdatedSuccessfully')}
                  </Text>
                )}
                <Button
                  label={t('ui.settingsScreen.saveProfileChanges')}
                  onPress={handleSaveGeneral}
                  variant="primary"
                  size="md"
                />
              </View>
            </View>

            {/* Password Management */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.passwordAndAuthentication')}
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
                        backgroundColor: colors.primaryLight,
                        borderRadius: radii.full,
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <KeyRound size={18} color={colors.primary} />
                  </View>
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                      {t('ui.settingsScreen.accountPassword')}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 1 }}>
                      {t('ui.settingsScreen.securedWithEndToEnd')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setPasswordSheetVisible(true)}
                  style={[
                    styles.addBtn,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 6,
                    },
                  ]}
                >
                  <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: 12 }}>
                    {t('ui.settingsScreen.changePassword')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Two-Factor Authentication */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.twoFactorAuthentication2fa')}
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
                      {t('ui.settingsScreen.authenticatorAppVerification')}
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
              {t('ui.settingsScreen.fido2BiometricPasskeys')}
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
                  {t('ui.settingsScreen.registeredHardwareTokens')}
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
                    {t('ui.settingsScreen.registerDevice')}
                  </Text>
                </TouchableOpacity>
              </View>

              {passkeys.length === 0 ? (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.lg,
                      padding: spacing.xl,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Fingerprint size={32} color={colors.textTertiary} />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                      marginTop: spacing.sm,
                    }}
                  >
                    {t('ui.settingsScreen.noBiometricPasskeysRegistered')}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.regular,
                      fontSize: typography.sizes.xs,
                      textAlign: 'center',
                      marginTop: 2,
                      maxWidth: 320,
                    }}
                  >
                    {t('ui.settingsScreen.registerTouchIdFaceId')}
                  </Text>
                </View>
              ) : (
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
                          {t('ui.settingsScreen.hardwareVerified')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 2: CATEGORIES & TAXONOMIES
        ========================================================================== */}
        {activeTab === 'categories' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.transactionCategoryTaxonomies')}
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
                    {t('ui.settingsScreen.personalizedDropdownManager')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 }}>
                    {t('ui.settingsScreen.tailorWhichIncomeStreamsExpense')}
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
                    {t('ui.settingsScreen.incomeStreams')}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.borderSubtle }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: 20 }}>
                    {enabledExpenseIds.length}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    {t('ui.settingsScreen.expenseEnvelopes')}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.borderSubtle }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.statusSuccess, fontFamily: typography.fonts.semiBold, fontSize: 20 }}>
                    140+
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    {t('ui.settingsScreen.subcategories')}
                  </Text>
                </View>
              </View>

              <Button
                label={t('ui.settingsScreen.openCategoryCustomizer')}
                onPress={() => setCategorySheetVisible(true)}
                variant="primary"
                size="md"
                icon={<Sliders size={16} color="#FFFFFF" />}
              />
            </View>
          </View>
        )}

        {/* =========================================================================
            TAB 3: PREFERENCES (THEME, COLORS, DENSITY, CURRENCY & FORMAT)
        ========================================================================== */}
        {activeTab === 'preferences' && (
          <View>
            {/* Color Theme & Appearance Card */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.themeAndAppearance')}
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              {/* Light vs Dark Mode */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setThemeMode('light')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderColor: !isDark ? colors.primary : colors.borderSubtle,
                    borderWidth: !isDark ? 2 : 1,
                    backgroundColor: !isDark ? colors.primaryLight : colors.surfaceSubtle,
                    borderRadius: radii.md,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                  }}
                >
                  <Sun size={15} color={!isDark ? colors.primary : colors.textSecondary} />
                  <Text
                    style={{
                      color: !isDark ? colors.primary : colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    {t('ui.settingsScreen.pureWhite')}
                  </Text>
                  {!isDark && <Check size={13} color={colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setThemeMode('dark')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderColor: isDark ? colors.primary : colors.borderSubtle,
                    borderWidth: isDark ? 2 : 1,
                    backgroundColor: isDark ? colors.primaryLight : colors.surfaceSubtle,
                    borderRadius: radii.md,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                  }}
                >
                  <Moon size={15} color={isDark ? colors.primary : colors.textSecondary} />
                  <Text
                    style={{
                      color: isDark ? colors.primary : colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    {t('ui.settingsScreen.midnightSlate')}
                  </Text>
                  {isDark && <Check size={13} color={colors.primary} />}
                </TouchableOpacity>
              </View>

              {/* Theme Colors (Accent Palettes) */}
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs, marginBottom: 6 }}>
                  {t('ui.settingsScreen.themeAccentColor')}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {THEME_ACCENTS.map((item) => {
                    const isSelected = accent === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setAccent(item.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isSelected ? colors.surfaceSubtle : 'transparent',
                          borderColor: isSelected ? item.swatch : colors.borderSubtle,
                          borderWidth: isSelected ? 2 : 1,
                          borderRadius: radii.full,
                          paddingVertical: 4,
                          paddingHorizontal: 9,
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: radii.full,
                            backgroundColor: item.swatch,
                            marginRight: 5,
                          }}
                        />
                        <Text
                          style={{
                            color: isSelected ? colors.textPrimary : colors.textSecondary,
                            fontFamily: isSelected ? typography.fonts.semiBold : typography.fonts.medium,
                            fontSize: 11,
                          }}
                        >
                          {item.name}
                        </Text>
                        {isSelected && (
                          <Check size={11} color={item.swatch} style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Interface Density */}
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs, marginBottom: 6 }}>
                  {t('ui.settingsScreen.interfaceDensity')}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setUiDensity('comfortable')}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderColor: uiDensity === 'comfortable' ? colors.primary : colors.borderSubtle,
                      borderWidth: uiDensity === 'comfortable' ? 2 : 1,
                      backgroundColor: uiDensity === 'comfortable' ? colors.primaryLight : colors.surfaceSubtle,
                      borderRadius: radii.md,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: uiDensity === 'comfortable' ? colors.primary : colors.textPrimary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: typography.sizes.xs,
                      }}
                    >
                      {t('ui.settingsScreen.comfortable')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setUiDensity('compact')}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderColor: uiDensity === 'compact' ? colors.primary : colors.borderSubtle,
                      borderWidth: uiDensity === 'compact' ? 2 : 1,
                      backgroundColor: uiDensity === 'compact' ? colors.primaryLight : colors.surfaceSubtle,
                      borderRadius: radii.md,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: uiDensity === 'compact' ? colors.primary : colors.textPrimary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: typography.sizes.xs,
                      }}
                    >
                      {t('ui.settingsScreen.highDensity')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Regional & Formatting */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.regionalCurrencyAndDateFormatting')}
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs, marginBottom: 6 }}>
                {t('ui.settingsScreen.primaryLedgerCurrency')}
              </Text>

              {/* 4 Currencies in a Single Row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(
                  [
                    { code: 'NGN', name: 'Naira', symbol: '₦' },
                    { code: 'USD', name: 'Dollar', symbol: '$' },
                    { code: 'GBP', name: 'Pound', symbol: '£' },
                    { code: 'EUR', name: 'Euro', symbol: '€' },
                  ] as const
                ).map((c) => {
                  const isSelected = currency === c.code;
                  return (
                    <TouchableOpacity
                      key={c.code}
                      onPress={() => setCurrency(c.code)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                        borderColor: isSelected ? colors.primary : colors.borderSubtle,
                        borderWidth: isSelected ? 2 : 1,
                        borderRadius: radii.md,
                        paddingVertical: 7,
                        paddingHorizontal: 6,
                      }}
                    >
                      <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: 12 }}>
                        {c.symbol} {c.code}
                      </Text>
                      {isSelected && <Check size={12} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date & Calendar Formatting */}
              <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs, marginBottom: 6 }}>
                  {t('ui.settingsScreen.dateAndCalendarFormatting')}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(
                    [
                      { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                      { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                      { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                    ] as const
                  ).map((f) => {
                    const isSelected = dateFormat === f.id;
                    return (
                      <TouchableOpacity
                        key={f.id}
                        onPress={() => setDateFormat(f.id)}
                        style={{
                          flex: 1,
                          backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.borderSubtle,
                          borderWidth: isSelected ? 2 : 1,
                          borderRadius: radii.md,
                          paddingVertical: 7,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? colors.primary : colors.textPrimary,
                            fontFamily: typography.fonts.semiBold,
                            fontSize: 11,
                          }}
                        >
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Financial Alerts & Notifications */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.financialAlertsAndNotifications')}
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <View style={{ gap: 10 }}>
                {/* Bill Reminders */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: spacing.md }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs }}>
                      {t('ui.settingsScreen.upcomingBillDueReminders')}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                      {t('ui.settingsScreen.alert3DaysAnd1')}
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
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs }}>
                      {t('ui.settingsScreen.envelopeLimitThresholdWarnings')}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                      {t('ui.settingsScreen.alertWhenCategorySpendingReaches')}
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
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs }}>
                      {t('ui.settingsScreen.weeklyCashFlowDigest')}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                      {t('ui.settingsScreen.weeklySummaryOfNetCash')}
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
            TAB 4: DATA MANAGEMENT & DANGER ZONE
        ========================================================================== */}
        {activeTab === 'data' && (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              {t('ui.settingsScreen.portabilityAndLedgerBackups')}
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
                {t('ui.settingsScreen.downloadYourCompleteUnencryptedFinancial')}
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
                        {t('ui.settingsScreen.exportLedgerTransactionsCsv')}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                        {t('ui.settingsScreen.compatibleWithMicrosoftExcelGoogle')}
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
                        {t('ui.settingsScreen.exportCompleteWorkspaceSnapshotJson')}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                        {t('ui.settingsScreen.includesAccountsBudgetEnvelopesRules')}
                      </Text>
                    </View>
                  </View>
                  <Download size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionHeading, { color: colors.statusDanger }]}>
              {t('ui.settingsScreen.dangerZone')}
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
                    {t('ui.settingsScreen.irreversibleAccountAndWorkspaceDeletion')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2, lineHeight: 18 }}>
                    {t('ui.settingsScreen.deletingYourAccountPermanentlyErases')}
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
                      {t('ui.settingsScreen.deleteAccountAndWorkspace')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      </View>

      {/* Sheets & Modals */}
      <ChangePasswordSheet
        visible={passwordSheetVisible}
        onClose={() => setPasswordSheetVisible(false)}
      />

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
  bodyLayout: {
    flex: 1,
  },
  desktopBody: {
    flexDirection: 'row',
  },
  mobileBody: {
    flexDirection: 'column',
  },
  settingsSidebar: {
    height: '100%',
  },
  sidebarItem: {},
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
  exportOption: {},
  dangerCard: {},
  deleteActionBtn: {},
});
