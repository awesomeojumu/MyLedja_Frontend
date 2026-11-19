import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  Home,
  Receipt,
  PieChart,
  Landmark,
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

  // Primary 5 Unified Hubs
  const primaryHubs = [
    {
      label: 'Dashboard',
      route: '/',
      icon: Home,
      isActive: (path: string) => path === '/' || path === '/index',
    },
    {
      label: 'Ledger',
      route: '/transactions',
      icon: Receipt,
      isActive: (path: string) => path === '/transactions',
    },
    {
      label: 'Planning',
      route: '/budget',
      icon: PieChart,
      isActive: (path: string) =>
        path === '/budget' ||
        path === '/plan' ||
        path === '/debts' ||
        path === '/goals' ||
        path === '/income',
    },
    {
      label: 'Accounts & Wealth',
      route: '/accounts',
      icon: Landmark,
      isActive: (path: string) => path === '/accounts' || path === '/investments',
    },
    {
      label: 'Analytics & Reports',
      route: '/reports',
      icon: BarChart3,
      isActive: (path: string) => path === '/reports' || path === '/cash-flow' || path === '/health',
    },
  ];

  // Secondary Tools
  const secondaryTools = [
    {
      label: 'Payees',
      route: '/payees',
      icon: Users,
      isActive: (path: string) => path === '/payees',
    },
    {
      label: 'Rules & Automation',
      route: '/rules',
      icon: GitBranch,
      isActive: (path: string) => path === '/rules',
    },
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
          {/* Main Financial Hubs */}
          <Text
            style={[
              styles.sectionHeader,
              {
                color: colors.textTertiary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 10,
                letterSpacing: 0.8,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.xs,
                paddingBottom: spacing.xxs,
                textTransform: 'uppercase',
              },
            ]}
          >
            Core Modules
          </Text>

          {primaryHubs.map((item) => {
            const isActive = item.isActive(pathname);
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
                      fontFamily: isActive ? typography.fonts.semiBold : typography.fonts.regular,
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

          {/* Divider */}
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.borderSubtle,
              marginVertical: spacing.sm,
              marginHorizontal: spacing.md,
            }}
          />

          {/* Secondary Tools */}
          <Text
            style={[
              styles.sectionHeader,
              {
                color: colors.textTertiary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 10,
                letterSpacing: 0.8,
                paddingHorizontal: spacing.md,
                paddingBottom: spacing.xxs,
                textTransform: 'uppercase',
              },
            ]}
          >
            Tools & Setup
          </Text>

          {secondaryTools.map((item) => {
            const isActive = item.isActive(pathname);
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
                      fontFamily: isActive ? typography.fonts.semiBold : typography.fonts.regular,
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
  sectionHeader: {},
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
