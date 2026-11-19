import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  TrendingUp,
  PieChart,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { NodeBreakdownSheet, type FlowNodeItem } from './NodeBreakdownSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

export interface CashFlowScreenProps {
  showHeader?: boolean;
}

export function CashFlowScreen({ showHeader = true }: CashFlowScreenProps = {}) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { events: dbEvents, getMonthlyTotals } = useDatabaseData();

  const [period, setPeriod] = useState<'this-month' | 'last-month' | '90-days'>('this-month');
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    totalMinor: bigint;
    items: FlowNodeItem[];
  } | null>(null);

  // Financial Stream Figures (connected to Database events)
  const totals = getMonthlyTotals('2026-11');
  const totalInflowMinor = totals.income;
  const spentMinor = totals.spent;
  const fixedMinor = (spentMinor * 55n) / 100n;
  const livingMinor = spentMinor - fixedMinor;
  const retainedMinor = totalInflowMinor > spentMinor ? totalInflowMinor - spentMinor : 0n;

  const fixedItems: FlowNodeItem[] = spentMinor > 0n ? [
    { id: 'f-1', label: 'Rent Allocation', amountMinor: (spentMinor * 30n) / 100n, percent: 55, transactionsCount: 1 },
    { id: 'f-2', label: 'Electricity & Utilities', amountMinor: (spentMinor * 15n) / 100n, percent: 27, transactionsCount: 1 },
    { id: 'f-3', label: 'Health Insurance', amountMinor: (spentMinor * 10n) / 100n, percent: 18, transactionsCount: 1 },
  ] : [];

  const livingItems: FlowNodeItem[] = spentMinor > 0n ? [
    { id: 'l-1', label: 'General Living Expenses', amountMinor: livingMinor, percent: 100, transactionsCount: 1 },
  ] : [];

  const inflowItems: FlowNodeItem[] = totalInflowMinor > 0n ? [
    { id: 'i-1', label: 'Earned & Other Inflows', amountMinor: totalInflowMinor, percent: 100, transactionsCount: 1 },
  ] : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      {showHeader && (
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
              Cash Flow Streams
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
              }}
            >
              Income to Outflow Ribbon
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { padding: showHeader ? spacing.lg : 0, paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Filter Tabs */}
        <View
          style={[
            styles.periodTabs,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: 3,
              marginBottom: spacing.lg,
            },
          ]}
        >
          {(
            [
              { id: 'this-month', label: 'This Month' },
              { id: 'last-month', label: 'Last Month' },
              { id: '90-days', label: 'Last 90 Days' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setPeriod(tab.id)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: period === tab.id ? colors.surface : 'transparent',
                  borderRadius: radii.full,
                  paddingVertical: 6,
                  flex: 1,
                  alignItems: 'center',
                },
              ]}
            >
              <Text
                style={{
                  color: period === tab.id ? colors.primary : colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Retained Cash Surplus Card */}
        <View
          style={[
            styles.heroCard,
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
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Net Cash Flow Surplus
          </Text>
          <Text
            style={{
              color: colors.statusSuccess,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            +{formatNaira(retainedMinor)}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: spacing.xxs,
            }}
          >
            45% of total income preserved for savings & investments
          </Text>
        </View>

        {/* Flow Streams */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Stream Ribbon Nodes
        </Text>

        {/* Node 1: Inflows */}
        <TouchableOpacity
          onPress={() =>
            setSelectedNode({
              title: 'Total Inflow',
              totalMinor: totalInflowMinor,
              items: inflowItems,
            })
          }
          style={[
            styles.streamCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
                },
              ]}
            >
              <ArrowDownLeft size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                1. Total Inflows
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                Salary, consulting & investment income
              </Text>
            </View>
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.body,
              }}
            >
              {formatNaira(totalInflowMinor)}
            </Text>
            <ChevronRight size={16} color={colors.textTertiary} style={{ marginLeft: 6 }} />
          </View>
        </TouchableOpacity>

        {/* Node 2: Fixed Commitments */}
        <TouchableOpacity
          onPress={() =>
            setSelectedNode({
              title: 'Fixed Commitments',
              totalMinor: fixedMinor,
              items: fixedItems,
            })
          }
          style={[
            styles.streamCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                },
              ]}
            >
              <ArrowUpRight size={18} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                2. Fixed Commitments
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                Rent, utilities, subscriptions (29%)
              </Text>
            </View>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.body,
              }}
            >
              {formatNaira(fixedMinor)}
            </Text>
            <ChevronRight size={16} color={colors.textTertiary} style={{ marginLeft: 6 }} />
          </View>
        </TouchableOpacity>

        {/* Node 3: Living & Discretionary */}
        <TouchableOpacity
          onPress={() =>
            setSelectedNode({
              title: 'Living & Discretionary',
              totalMinor: livingMinor,
              items: livingItems,
            })
          }
          style={[
            styles.streamCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                },
              ]}
            >
              <ArrowUpRight size={18} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                3. Living & Discretionary
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                Food, transport, entertainment (26%)
              </Text>
            </View>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.body,
              }}
            >
              {formatNaira(livingMinor)}
            </Text>
            <ChevronRight size={16} color={colors.textTertiary} style={{ marginLeft: 6 }} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Node Breakdown Sheet */}
      {selectedNode && (
        <NodeBreakdownSheet
          visible={Boolean(selectedNode)}
          onClose={() => setSelectedNode(null)}
          nodeTitle={selectedNode.title}
          nodeTotalMinor={selectedNode.totalMinor}
          items={selectedNode.items}
        />
      )}
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
  periodTabs: {
    flexDirection: 'row',
  },
  tabBtn: {},
  heroCard: {
    borderWidth: 1,
  },
  streamCard: {
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
