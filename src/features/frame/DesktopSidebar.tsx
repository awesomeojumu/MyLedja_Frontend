import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  Home,
  Receipt,
  PieChart,
  Landmark,
  CalendarDays,
  CreditCard,
  PiggyBank,
  TrendingUp,
  BarChart3,
  GitBranch,
  Settings,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react-native';

import { useTheme } from '../../design';
import { useAuth } from '../auth/AuthProvider';

export function DesktopSidebar() {
  const { colors, typography, spacing, radii } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Main daily finance navigation list
  const navItems = [
    { label: 'Dashboard', route: '/', icon: Home },
    { label: 'Transactions', route: '/transactions', icon: Receipt },
    { label: 'Budget', route: '/budget', icon: PieChart },
    { label: 'Accounts', route: '/accounts', icon: Landmark },
    { label: 'Bills & Recurring', route: '/plan', icon: CalendarDays },
    { label: 'Debts & Loans', route: '/debts', icon: CreditCard },
    { label: 'Savings Goals', route: '/goals', icon: PiggyBank },
    { label: 'Investments', route: '/investments', icon: TrendingUp },
  ];

  // User account dropdown items
  const dropdownItems = [
    { label: 'Reports', route: '/reports', icon: BarChart3 },
    { label: 'Rules', route: '/rules', icon: GitBranch },
    { label: 'Settings', route: '/settings', icon: Settings },
  ];

  const displayName = user?.name || 'Awesome Ojumu';
  const displayEmail = user?.email || 'ayobamiojumu@gmail.com';

  const initials = useMemo(() => {
    if (displayName && displayName.trim()) {
      const parts = displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
      }
      return displayName.slice(0, 2).toUpperCase();
    }
    if (displayEmail) return displayEmail.slice(0, 2).toUpperCase();
    return 'AO';
  }, [displayName, displayEmail]);

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          width: 240,
        },
      ]}
    >
      {/* App Branding */}
      <View style={[styles.brandArea, { borderBottomColor: colors.border, padding: spacing.lg }]}>
        <Text
          style={[
            styles.brandTitle,
            {
              color: colors.primary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.xl,
            },
          ]}
        >
          MyLedja
        </Text>
      </View>

      {/* Navigation List */}
      <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
        <View style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }}>
          {navItems.map((item) => {
            const isActive = pathname === item.route;
            const IconComponent = item.icon;

            return (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
                style={[
                  styles.navItem,
                  {
                    borderRadius: radii.md,
                    paddingVertical: spacing.sm + 2,
                    paddingHorizontal: spacing.md,
                    marginBottom: spacing.xxs,
                    backgroundColor: isActive ? colors.primaryLight : 'transparent',
                  },
                ]}
              >
                <IconComponent
                  size={18}
                  color={isActive ? colors.primary : colors.textSecondary}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <Text
                  style={[
                    styles.navLabel,
                    {
                      marginLeft: spacing.md,
                      fontFamily: isActive ? typography.fonts.medium : typography.fonts.regular,
                      fontSize: typography.sizes.bodySm,
                      color: isActive ? colors.primary : colors.textPrimary,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Outside click backdrop when dropdown is open */}
      {dropdownOpen && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setDropdownOpen(false)}
          style={styles.backdrop}
        />
      )}

      {/* Sidebar Footer with Name, Avatar, and Fitting Dropdown */}
      <View
        style={[
          styles.footerArea,
          {
            borderTopColor: colors.border,
            padding: spacing.sm,
            position: 'relative',
          },
        ]}
      >
        {/* Dropdown Menu Popover */}
        {dropdownOpen && (
          <View
            style={[
              styles.dropdownMenu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.xl,
              },
            ]}
          >
            {/* Header inside Dropdown */}
            <View
              style={[
                styles.dropdownHeader,
                {
                  borderBottomColor: colors.borderSubtle,
                  paddingBottom: spacing.sm,
                  marginBottom: spacing.xs,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarCircleSmall,
                  {
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <Text style={[styles.avatarTextSmall, { color: colors.primary }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.sm,
                    color: colors.textPrimary,
                  }}
                >
                  {displayName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: typography.fonts.regular,
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 1,
                  }}
                >
                  {displayEmail}
                </Text>
              </View>
            </View>

            {/* Menu Items: Health Score, Reports, Rules, Settings */}
            <View style={{ paddingVertical: 2 }}>
              {dropdownItems.map((item) => {
                const isActive = pathname === item.route;
                const IconComp = item.icon;

                return (
                  <TouchableOpacity
                    key={item.route}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDropdownOpen(false);
                      router.push(item.route as any);
                    }}
                    style={[
                      styles.dropdownItem,
                      {
                        borderRadius: radii.md,
                        backgroundColor: isActive ? colors.primaryLight : 'transparent',
                        paddingVertical: spacing.xs + 3,
                        paddingHorizontal: spacing.sm,
                        marginBottom: 2,
                      },
                    ]}
                  >
                    <IconComp
                      size={16}
                      color={isActive ? colors.primary : colors.textSecondary}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <Text
                      style={[
                        styles.dropdownItemLabel,
                        {
                          fontFamily: isActive ? typography.fonts.medium : typography.fonts.regular,
                          fontSize: typography.sizes.sm,
                          color: isActive ? colors.primary : colors.textPrimary,
                          marginLeft: spacing.sm,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Divider */}
            <View
              style={[
                styles.menuDivider,
                {
                  backgroundColor: colors.borderSubtle,
                  marginVertical: spacing.xs,
                },
              ]}
            />

            {/* Log Out Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={async () => {
                setDropdownOpen(false);
                await signOut();
                router.replace('/(auth)/sign-in' as any);
              }}
              style={[
                styles.dropdownItem,
                {
                  borderRadius: radii.md,
                  paddingVertical: spacing.xs + 3,
                  paddingHorizontal: spacing.sm,
                },
              ]}
            >
              <LogOut size={16} color={colors.statusDanger} strokeWidth={1.8} />
              <Text
                style={[
                  styles.dropdownItemLabel,
                  {
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.sm,
                    color: colors.statusDanger,
                    marginLeft: spacing.sm,
                  },
                ]}
              >
                Log Out
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Trigger Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setDropdownOpen((prev) => !prev)}
          style={[
            styles.profileButton,
            {
              backgroundColor: dropdownOpen ? colors.surfaceSubtle : 'transparent',
              borderRadius: radii.lg,
              paddingVertical: spacing.xs + 2,
              paddingHorizontal: spacing.xs + 4,
            },
          ]}
        >
          {/* Avatar */}
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: colors.primaryLight,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 12,
                },
              ]}
            >
              {initials}
            </Text>
          </View>

          {/* Name & Email */}
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text
              numberOfLines={1}
              style={[
                styles.profileName,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.xs + 1,
                },
              ]}
            >
              {displayName}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.profileEmail,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: 11,
                  marginTop: 1,
                },
              ]}
            >
              {displayEmail}
            </Text>
          </View>

          <ChevronsUpDown size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  brandArea: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandTitle: {
    letterSpacing: -0.5,
  },
  navList: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navLabel: {},
  footerArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    letterSpacing: 0.5,
  },
  profileName: {},
  profileEmail: {},
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  dropdownMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 8,
    right: 8,
    marginBottom: 8,
    borderWidth: 1,
    padding: 10,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarCircleSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownItemLabel: {},
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
