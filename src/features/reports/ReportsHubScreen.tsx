import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  BarChart3,
  PieChart,
  TrendingUp,
  Receipt,
  Users,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { CashFlowScreen } from '../cashflow/CashFlowScreen';
import { HealthScreen } from '../health/HealthScreen';

interface ReportCardItem {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: any;
}

export function ReportsHubScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const [analyticsTab, setAnalyticsTab] = useState<'reports' | 'cashflow' | 'health'>('reports');

  const standardReports: ReportCardItem[] = [
    {
      id: 'net-worth',
      title: 'Net Worth Growth Trajectory',
      description: 'Historical assets vs. liabilities trend across the last 12 months.',
      category: 'Wealth & Assets',
      icon: TrendingUp,
    },
    {
      id: 'spending-category',
      title: 'Monthly Spending by Category',
      description: 'Visual breakdown of envelope expenses, top spend categories and variances.',
      category: 'Expenses',
      icon: PieChart,
    },
    {
      id: 'income-vs-expense',
      title: 'Income vs. Expense Delta',
      description: 'Surplus cash flow retention per month compared against statutory limits.',
      category: 'Cash Flow',
      icon: BarChart3,
    },
    {
      id: 'statutory-deductions',
      title: 'PAYE Tax & Pension Deductions',
      description: 'Detailed statement of Nigerian PAYE, pension contributions and NHF.',
      category: 'Tax & Compliance',
      icon: Receipt,
    },
    {
      id: 'top-merchants',
      title: 'Top Payees & Merchants',
      description: 'Highest volume counterparties, supermarket visits, and transport fees.',
      category: 'Vendors',
      icon: Users,
    },
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
            Financial Reports
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Analytics, Tax Statements & Trends
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/reports/build' as any)}
          style={[
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            },
          ]}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            Custom Report
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg, paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Analytics Hub Unified Segmented Switcher */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.full,
            padding: 3,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          {[
            { id: 'reports', label: 'Reports Library' },
            { id: 'cashflow', label: 'Cash Flow Streams' },
            { id: 'health', label: 'Health Score' },
          ].map((tab) => {
            const isActive = analyticsTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setAnalyticsTab(tab.id as any)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: radii.full,
                  backgroundColor: isActive ? colors.surface : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: isActive ? '#000000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isActive ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: isActive ? 1 : 0,
                }}
              >
                <Text
                  style={{
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontFamily: isActive ? typography.fonts.semiBold : typography.fonts.medium,
                    fontSize: 11.5,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {analyticsTab === 'cashflow' && <CashFlowScreen showHeader={false} />}

        {analyticsTab === 'health' && <HealthScreen showHeader={false} />}

        {analyticsTab === 'reports' && (
          <View>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: spacing.md,
              }}
            >
              Standard Reports Library
            </Text>

        {standardReports.map((report) => {
          const IconComp = report.icon;
          return (
            <TouchableOpacity
              key={report.id}
              onPress={() => router.push(`/reports/view/${report.id}` as any)}
              style={[
                styles.reportCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  <IconComp size={18} color={colors.primary} />
                </View>

                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                    }}
                  >
                    {report.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      fontFamily: typography.fonts.regular,
                      marginTop: 2,
                    }}
                  >
                    {report.description}
                  </Text>
                  <View
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderRadius: radii.full,
                        alignSelf: 'flex-start',
                        marginTop: spacing.xs,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontSize: 10,
                        fontFamily: typography.fonts.medium,
                      }}
                    >
                      {report.category}
                    </Text>
                  </View>
                </View>

                <ChevronRight size={18} color={colors.textTertiary} style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>
          );
        })}
          </View>
        )}
      </ScrollView>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  reportCard: {
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagBadge: {},
});
