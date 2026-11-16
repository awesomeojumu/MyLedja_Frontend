import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Sparkles,
  BarChart,
  PieChart,
  Calendar,
  Check,
} from 'lucide-react-native';
import { useTheme, Button } from '../../design';
import { SaveReportSheet } from './SaveReportSheet';

export function ReportBuilderScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const [metric, setMetric] = useState<'expenses' | 'income' | 'net-worth'>('expenses');
  const [grouping, setGrouping] = useState<'category' | 'payee' | 'account'>('category');
  const [timeframe, setTimeframe] = useState<'30-days' | '90-days' | '1-year'>('90-days');
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);

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
            Custom Report Builder
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            3-Step Analytical Query
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Metric */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={[
              styles.stepHeader,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: spacing.xs,
              },
            ]}
          >
            1. Select Primary Metric
          </Text>
          <View style={[styles.pillGrid, { gap: spacing.xs }]}>
            {[
              { id: 'expenses', label: 'Total Expenses' },
              { id: 'income', label: 'Total Inflows' },
              { id: 'net-worth', label: 'Net Cash Flow' },
            ].map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setMetric(m.id as any)}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: metric === m.id ? colors.primaryLight : colors.surface,
                    borderColor: metric === m.id ? colors.primary : colors.borderSubtle,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                ]}
              >
                <Text
                  style={{
                    color: metric === m.id ? colors.primary : colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {m.label}
                </Text>
                {metric === m.id && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 2: Grouping */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={[
              styles.stepHeader,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: spacing.xs,
              },
            ]}
          >
            2. Group & Slice By
          </Text>
          <View style={[styles.pillGrid, { gap: spacing.xs }]}>
            {[
              { id: 'category', label: 'Budget Category Envelopes' },
              { id: 'payee', label: 'Merchant / Counterparty' },
              { id: 'account', label: 'Bank & Wallet Accounts' },
            ].map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGrouping(g.id as any)}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: grouping === g.id ? colors.primaryLight : colors.surface,
                    borderColor: grouping === g.id ? colors.primary : colors.borderSubtle,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                ]}
              >
                <Text
                  style={{
                    color: grouping === g.id ? colors.primary : colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {g.label}
                </Text>
                {grouping === g.id && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 3: Timeframe */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={[
              styles.stepHeader,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: spacing.xs,
              },
            ]}
          >
            3. Date Timeframe
          </Text>
          <View style={[styles.timeRow, { gap: spacing.xs }]}>
            {[
              { id: '30-days', label: 'Last 30 Days' },
              { id: '90-days', label: 'Last 90 Days' },
              { id: '1-year', label: 'Past 12 Months' },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTimeframe(t.id as any)}
                style={[
                  styles.timeBtn,
                  {
                    backgroundColor: timeframe === t.id ? colors.primaryLight : colors.surface,
                    borderColor: timeframe === t.id ? colors.primary : colors.borderSubtle,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    flex: 1,
                    alignItems: 'center',
                  },
                ]}
              >
                <Text
                  style={{
                    color: timeframe === t.id ? colors.primary : colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Report CTA */}
        <Button
          label="Save & Generate Report"
          onPress={() => setSaveSheetVisible(true)}
          variant="primary"
          size="lg"
        />
      </ScrollView>

      {/* Save Sheet */}
      <SaveReportSheet
        visible={saveSheetVisible}
        onClose={() => setSaveSheetVisible(false)}
        onSave={() => {
          router.replace('/reports' as any);
        }}
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
  stepHeader: {},
  pillGrid: {},
  optionPill: {
    borderWidth: 1,
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeBtn: {
    borderWidth: 1,
  },
});
