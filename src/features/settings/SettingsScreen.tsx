import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  User,
  Moon,
  Sun,
  Shield,
  Fingerprint,
  Download,
  LogOut,
  Trash2,
  ChevronRight,
  Briefcase,
  Check,
  Sliders,
  Layers,
} from 'lucide-react-native';
import { useTheme, Button, TextInput } from '../../design';
import { useAuth } from '../auth/AuthProvider';
import { TwoFactorSetupSheet } from './TwoFactorSetupSheet';
import { PasskeySheet } from './PasskeySheet';
import { DeleteAccountModal } from './DeleteAccountModal';
import { CategoryPreferencesSheet } from './CategoryPreferencesSheet';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';

export function SettingsScreen() {
  const { colors, typography, spacing, radii, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { enabledIncomeIds, enabledExpenseIds } = useCategoryPreferences();

  // State
  const [workspaceName, setWorkspaceName] = useState(user?.workspaceName || 'Personal Workspace');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<string[]>(['iPhone 15 Pro (Touch ID)']);

  // Sheets
  const [twoFactorVisible, setTwoFactorVisible] = useState(false);
  const [passkeyVisible, setPasskeyVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in' as any);
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
            Preferences & Settings
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Profile, Security, Appearance & Data
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Profile & Workspace */}
        <Text
          style={[
            styles.sectionHeading,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            },
          ]}
        >
          User & Workspace
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View
              style={[
                styles.avatarBadge,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
                },
              ]}
            >
              <User size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                {user?.name || 'MyLedja User'}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                {user?.email || 'user@example.com'}
              </Text>
            </View>
          </View>

          <TextInput
            label="Workspace Name"
            value={workspaceName}
            onChangeText={setWorkspaceName}
            leftElement={<Briefcase size={16} color={colors.textTertiary} />}
          />
        </View>

        {/* Section 2: Appearance & Theme */}
        <Text
          style={[
            styles.sectionHeading,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            },
          ]}
        >
          Appearance
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                },
              ]}
            >
              {isDark ? (
                <Moon size={18} color={colors.primary} />
              ) : (
                <Sun size={18} color={colors.statusWarning} />
              )}
            </View>
            <View style={{ marginLeft: spacing.md }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                Dark Theme
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                {isDark ? 'Midnight Slate mode active' : 'Pure White mode active'}
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.borderSubtle, true: colors.primary }}
          />
        </View>

        {/* Section: Category Preferences */}
        <Text
          style={[
            styles.sectionHeading,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            },
          ]}
        >
          Categories & Dropdowns
        </Text>
        <TouchableOpacity
          onPress={() => setCategorySheetVisible(true)}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm }}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Sliders size={18} color={colors.primary} />
            </View>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                Personalized Dropdown Categories
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  marginTop: 2,
                }}
              >
                {enabledIncomeIds.length} Income • {enabledExpenseIds.length} Expense active
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Section 3: Security & Sign-in */}
        <Text
          style={[
            styles.sectionHeading,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            },
          ]}
        >
          Security & Access
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          {/* 2FA Row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: spacing.md,
              borderBottomColor: colors.borderSubtle,
              borderBottomWidth: StyleSheet.hairlineWidth,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <Shield size={18} color={colors.primary} />
              </View>
              <View style={{ marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  Two-Factor Authentication
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {twoFactorEnabled ? 'Enabled via Authenticator' : 'Disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={(val) => {
                if (val) {
                  setTwoFactorVisible(true);
                } else {
                  setTwoFactorEnabled(false);
                }
              }}
              trackColor={{ false: colors.borderSubtle, true: colors.primary }}
            />
          </View>

          {/* Passkeys List */}
          <View style={{ paddingTop: spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.xs,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                Biometric Passkeys
              </Text>
              <TouchableOpacity
                onPress={() => setPasskeyVisible(true)}
                style={[
                  styles.addPasskeyBtn,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    fontFamily: typography.fonts.semiBold,
                  }}
                >
                  + Add Passkey
                </Text>
              </TouchableOpacity>
            </View>

            {passkeys.map((p, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 6,
                }}
              >
                <Fingerprint size={16} color={colors.textSecondary} />
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.regular,
                    marginLeft: spacing.xs,
                  }}
                >
                  {p}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section 4: Data Export */}
        <Text
          style={[
            styles.sectionHeading,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            },
          ]}
        >
          Data & Privacy
        </Text>
        <TouchableOpacity
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.xl,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Download size={18} color={colors.textPrimary} />
            </View>
            <View style={{ marginLeft: spacing.md }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                Export All Workspace Data
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                Download complete SQLite snapshot & CSV ledger
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Sign Out CTA */}
        <View style={{ marginBottom: spacing.md }}>
          <Button
            label="Sign Out of MyLedja"
            onPress={handleSignOut}
            variant="secondary"
            size="lg"
            icon={<LogOut size={16} color={colors.textPrimary} />}
          />
        </View>

        {/* Delete Workspace */}
        <TouchableOpacity
          onPress={() => setDeleteModalVisible(true)}
          style={[
            styles.deleteBtn,
            {
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Trash2 size={16} color={colors.statusDanger} />
          <Text
            style={{
              color: colors.statusDanger,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.bodySm,
              marginLeft: spacing.xs,
            }}
          >
            Delete Account & Workspace
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sheets */}
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
          setPasskeys((prev) => [...prev, name]);
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
  content: {
    paddingBottom: 40,
  },
  sectionHeading: {},
  card: {
    borderWidth: 1,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPasskeyBtn: {},
  deleteBtn: {},
});
