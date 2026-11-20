import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  Home,
  Receipt,
  PieChart,
  Landmark,
  ArrowLeftRight,
  HeartPulse,
  CalendarDays,
  CreditCard,
  PiggyBank,
  TrendingUp,
  BarChart3,
  Users,
  GitBranch,
  Settings,
} from 'lucide-react-native';

import { useTheme, ThemeToggle } from '../../design';
import { useAuth } from '../auth/AuthProvider';

export function DesktopSidebar() {
  const { colors, typography, spacing, radii } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspaceId } = useAuth();

  const navItems = [
    { label: 'Dashboard', route: '/', icon: Home },
    { label: 'Transactions', route: '/transactions', icon: Receipt },
    { label: 'Budget', route: '/budget', icon: PieChart },
    { label: 'Accounts', route: '/accounts', icon: Landmark },
    { label: 'Cash Flow', route: '/cash-flow', icon: ArrowLeftRight },
    { label: 'Health Score', route: '/health', icon: HeartPulse },
    { label: 'Bills & Recurring', route: '/plan', icon: CalendarDays },
    { label: 'Debts & Loans', route: '/debts', icon: CreditCard },
    { label: 'Savings Goals', route: '/goals', icon: PiggyBank },
    { label: 'Investments', route: '/investments', icon: TrendingUp },
    { label: 'Reports', route: '/reports', icon: BarChart3 },
    { label: 'Payees', route: '/payees', icon: Users },
    { label: 'Rules', route: '/rules', icon: GitBranch },
  ];

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
        <Text
          style={[
            styles.workspaceName,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: spacing.xxs,
            },
          ]}
        >
          Workspace: {workspaceId ?? 'Personal'}
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

      {/* Sidebar Footer */}
      <View
        style={[
          styles.footerArea,
          {
            borderTopColor: colors.border,
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.footerRow}>
          <TouchableOpacity
            onPress={() => router.push('/settings' as any)}
            activeOpacity={0.7}
            style={[
              styles.settingsBtn,
              {
                borderRadius: radii.md,
                padding: spacing.sm,
              },
            ]}
          >
            <Settings size={18} color={colors.textSecondary} />
            <Text
              style={[
                styles.footerLabel,
                {
                  marginLeft: spacing.sm,
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.sm,
                },
              ]}
            >
              Settings
            </Text>
          </TouchableOpacity>

          <ThemeToggle size="sm" />
        </View>

        {user && (
          <View style={[styles.userBadge, { marginTop: spacing.sm }]}>
            <Text
              numberOfLines={1}
              style={[
                styles.userName,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                },
              ]}
            >
              {user.email}
            </Text>
          </View>
        )}
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
  },
  brandArea: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandTitle: {
    letterSpacing: -0.5,
  },
  workspaceName: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  footerLabel: {},
  userBadge: {
    paddingHorizontal: 4,
  },
  userName: {},
});
