import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  TrendingUp,
  CalendarDays,
  CreditCard,
  PiggyBank,
  Briefcase,
  BarChart3,
  FilePlus2,
  Users,
  GitBranch,
  Bell,
  Settings,
  Search,
  type LucideIcon,
} from 'lucide-react-native';

import { useTheme, TextInput } from '../../design';
import { useAuth } from '../auth/AuthProvider';
import { ToolTileItem } from './ToolTileItem';

interface ToolItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: LucideIcon;
  group: 'planning' | 'wealth' | 'tools';
  badge?: string;
}

export function MoreHubScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { user, workspaceId } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');

  const tools: ToolItem[] = [
    // 1. Planning & Income
    {
      id: 'income',
      title: 'Income Planning',
      subtitle: 'Salary take-home pay, statutory PAYE/tax, and income streams',
      route: '/income',
      icon: TrendingUp,
      group: 'planning',
    },
    {
      id: 'plan',
      title: 'Bills & Subscriptions',
      subtitle: 'Recurring utility bills, calendar schedule, and reminders',
      route: '/plan',
      icon: CalendarDays,
      group: 'planning',
    },
    {
      id: 'debts',
      title: 'Debts & Loans',
      subtitle: 'Money lent, money borrowed, and payoff strategy calculator',
      route: '/debts',
      icon: CreditCard,
      group: 'planning',
    },
    {
      id: 'goals',
      title: 'Savings Goals',
      subtitle: 'Target funds, auto-allocation schedules, and progress rings',
      route: '/goals',
      icon: PiggyBank,
      group: 'planning',
    },

    // 2. Wealth & Intelligence
    {
      id: 'investments',
      title: 'Investments Portfolio',
      subtitle: 'Stocks, crypto, real estate, cost basis, and unrealized gains',
      route: '/investments',
      icon: Briefcase,
      group: 'wealth',
    },
    {
      id: 'reports',
      title: 'Reports Hub',
      subtitle: 'Net worth over time, category breakdowns, and dashboards',
      route: '/reports',
      icon: BarChart3,
      group: 'wealth',
    },
    {
      id: 'reports-build',
      title: 'Report Builder',
      subtitle: 'Create bespoke custom financial reports in 3 simple steps',
      route: '/reports/build',
      icon: FilePlus2,
      group: 'wealth',
    },

    // 3. Tools & Preferences
    {
      id: 'payees',
      title: 'Payees Directory',
      subtitle: 'Merchant directory, default categories, and alias matching',
      route: '/payees',
      icon: Users,
      group: 'tools',
    },
    {
      id: 'rules',
      title: 'Rules & Automation',
      subtitle: 'Plain English auto-categorization and renaming engine',
      route: '/rules',
      icon: GitBranch,
      group: 'tools',
    },
    {
      id: 'notifications',
      title: 'Notifications Hub',
      subtitle: 'Due bills, overspending alerts, and account notices',
      route: '/notifications',
      icon: Bell,
      group: 'tools',
    },
    {
      id: 'settings',
      title: 'Settings & Security',
      subtitle: 'Theme toggle, 2FA, passkeys, bank sync, and workspace data',
      route: '/settings',
      icon: Settings,
      group: 'tools',
    },
  ];

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase();
    return tools.filter(
      (t) => t.title.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q)
    );
  }, [tools, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map<'planning' | 'wealth' | 'tools', ToolItem[]>();
    for (const t of filteredTools) {
      const list = map.get(t.group) ?? [];
      list.push(t);
      map.set(t.group, list);
    }

    const order: { key: 'planning' | 'wealth' | 'tools'; title: string }[] = [
      { key: 'planning', title: 'Planning & Financial Health' },
      { key: 'wealth', title: 'Wealth & Analytics' },
      { key: 'tools', title: 'Automation & Preferences' },
    ];

    return order
      .filter((o) => map.has(o.key))
      .map((o) => ({ key: o.key, title: o.title, items: map.get(o.key)! }));
  }, [filteredTools]);

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
        {/* Header Title & Subtitle */}
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={[
              styles.heading,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.xl,
              },
            ]}
          >
            More Financial Tools
          </Text>
          <Text
            style={[
              styles.subheading,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
                marginTop: 2,
              },
            ]}
          >
            Launchpad for wealth planning, reports, automations, and settings
          </Text>
        </View>

        {/* Search Bar */}
        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            placeholder="Search all 13 tools & features..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftElement={<Search size={18} color={colors.textTertiary} />}
          />
        </View>

        {/* Categorized Tool Cards */}
        {groups.map((sec) => (
          <View key={sec.key} style={[styles.section, { marginBottom: spacing.lg }]}>
            <Text
              style={[
                styles.sectionTitle,
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
              {sec.items.map((t) => (
                <ToolTileItem
                  key={t.id}
                  title={t.title}
                  subtitle={t.subtitle}
                  icon={t.icon}
                  badge={t.badge}
                  onPress={() => router.push(t.route as any)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* User Workspace Info Footer */}
        <View
          style={[
            styles.footerCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text
            style={[
              styles.footerText,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
              },
            ]}
          >
            Active Workspace: <Text style={{ fontFamily: typography.fonts.medium, color: colors.textPrimary }}>{workspaceId ?? 'Personal'}</Text>
            {user?.email ? ` • Signed in as ${user.email}` : ''}
          </Text>
        </View>
      </ScrollView>
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
  heading: {
    letterSpacing: -0.3,
  },
  subheading: {},
  section: {
    width: '100%',
  },
  sectionTitle: {},
  cardContainer: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  footerCard: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {},
});
