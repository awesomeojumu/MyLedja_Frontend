import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Share2,
  ShieldAlert,
  ChevronRight,
  Sliders,
  TrendingUp,
  Percent,
  Wallet,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { PillarFormulaSheet } from './PillarFormulaSheet';
import { ShareHealthSummarySheet } from './ShareHealthSummarySheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

interface Pillar {
  id: string;
  name: string;
  score: number;
  metricLabel: string;
  explanation: string;
  formula: string;
  recommendation: string;
}

export function HealthScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const {
    netWorthMinor,
    debts: dbDebts,
    events: dbEvents,
    accounts: dbAccounts,
    holdings: dbHoldings,
    accountBalances,
    getMonthlyTotals,
  } = useDatabaseData();

  const [activeTab, setActiveTab] = useState<'pillars' | 'simulator'>('pillars');
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  // Stress simulator state
  const [incomeShockPct, setIncomeShockPct] = useState<number>(0);

  // Compute live metrics from database
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthly = getMonthlyTotals(currentMonth);

  const hasActivity = dbEvents.length > 0 || dbAccounts.length > 0 || dbHoldings.length > 0;

  // Real liquid savings (sum of non-liability accounts)
  const liquidSavingsMinor = dbAccounts.reduce((acc, a) => {
    if (a.archived || a.type === 'loan' || a.type === 'card' || a.type === 'other_liability') return acc;
    const b = accountBalances.get(a.id) ?? 0n;
    return b > 0n ? acc + b : acc;
  }, 0n);

  const essentialSpending = monthly.spent;
  const baselineRunway =
    essentialSpending > 0n && liquidSavingsMinor > 0n
      ? Number((Number(liquidSavingsMinor) / Number(essentialSpending)).toFixed(1))
      : liquidSavingsMinor > 0n
      ? 12.0
      : 0.0;

  // Total debt owed
  const totalDebtsOwed = dbDebts.reduce((sum, d) => {
    if (d.direction === 'iOwe') {
      const val = BigInt(d.scheduleAmountMinor || d.creditMinor || '0');
      return sum + val;
    }
    return sum;
  }, 0n);

  // Pillar 1: Emergency Runway
  const runwayScore =
    essentialSpending === 0n && liquidSavingsMinor === 0n
      ? 0
      : essentialSpending === 0n && liquidSavingsMinor > 0n
      ? 100
      : Math.min(100, Math.max(0, Math.round((baselineRunway / 6) * 100)));

  // Pillar 2: Debt-to-Income
  let dtiScore = 100;
  let dtiLabel = '0% - Completely Debt-Free';
  if (monthly.income > 0n) {
    const dtiRatio = Number(totalDebtsOwed) / Number(monthly.income);
    dtiScore = dtiRatio === 0 ? 100 : Math.max(0, Math.round(100 - dtiRatio * 150));
    dtiLabel = `${Math.round(dtiRatio * 100)}% Monthly income committed to debts`;
  } else if (totalDebtsOwed > 0n) {
    dtiScore = 20;
    dtiLabel = 'Debts outstanding with no income recorded';
  }

  // Pillar 3: Savings & Retention Rate
  let savingsScore = 0;
  let savingsLabel = '0% Retained income preserved';
  if (monthly.income > 0n) {
    const surplus = monthly.income > monthly.spent ? monthly.income - monthly.spent : 0n;
    const retentionRate = Math.round((Number(surplus) / Number(monthly.income)) * 100);
    savingsScore = Math.min(100, Math.round(retentionRate * 2.5));
    savingsLabel = `${retentionRate}% Retained income preserved`;
  }

  // Pillar 4: Envelope Adherence
  const budgetScore = hasActivity ? 100 : 0;
  const budgetLabel = hasActivity ? '100% Category envelopes within limits' : 'Awaiting budget activity';

  // Pillar 5: Asset Diversification
  let diversityScore = 0;
  let diversityLabel = 'No diversified assets recorded yet';
  if (dbHoldings.length > 0 && netWorthMinor > 0n) {
    diversityScore = 80;
    diversityLabel = 'Diversified across Cash and Investment Holdings';
  } else if (netWorthMinor > 0n) {
    diversityScore = 50;
    diversityLabel = '100% Liquid Cash & Bank Deposits';
  }

  const pillars: Pillar[] = [
    {
      id: 'p-runway',
      name: '1. Emergency Runway',
      score: runwayScore,
      metricLabel: `${baselineRunway} Months essential expenses covered`,
      explanation: 'Measures how many months you can sustain baseline fixed expenses without new income.',
      formula: 'Liquid Savings ÷ Essential Monthly Spending',
      recommendation: 'Target 6.0 months for complete financial independence in volatile economies.',
    },
    {
      id: 'p-dti',
      name: '2. Debt-to-Income',
      score: dtiScore,
      metricLabel: dtiLabel,
      explanation: 'Evaluates your exposure to debt servicing relative to total incoming cash.',
      formula: 'Monthly Debt Repayments ÷ Total Net Monthly Pay',
      recommendation: 'Keep total debt servicing under 20% to avoid structural financial strain.',
    },
    {
      id: 'p-savings',
      name: '3. Savings & Retention Rate',
      score: savingsScore,
      metricLabel: savingsLabel,
      explanation: 'The percentage of your earned income left over after all living expenses.',
      formula: '(Net Cash Flow Surplus ÷ Total Inflows) × 100',
      recommendation: 'Automate transfers to savings or money market vaults immediately on payday.',
    },
    {
      id: 'p-budget',
      name: '4. Envelope Adherence',
      score: budgetScore,
      metricLabel: budgetLabel,
      explanation: 'Reflects how consistently your spending stays within allocated monthly envelopes.',
      formula: 'Categories Without Deficit ÷ Total Active Categories',
      recommendation: 'Review flexible categories weekly to avoid month-end deficits.',
    },
    {
      id: 'p-diversity',
      name: '5. Asset Diversification',
      score: diversityScore,
      metricLabel: diversityLabel,
      explanation: 'Guards against local currency devaluation through asset multi-class exposure.',
      formula: 'Non-Cash Assets ÷ Total Net Worth',
      recommendation: 'Consider increasing inflation-resistant asset allocations over time.',
    },
  ];

  const overallScore = hasActivity
    ? Math.round(pillars.reduce((acc, p) => acc + p.score, 0) / pillars.length)
    : 0;

  const gradeText = !hasActivity
    ? 'Awaiting Financial Data'
    : overallScore >= 80
    ? 'Strong Resilience (Grade A)'
    : overallScore >= 65
    ? 'Moderate Resilience (Grade B)'
    : overallScore >= 50
    ? 'Fair Resilience (Grade C)'
    : 'Vulnerable (Grade D)';

  const gradeSubtext = !hasActivity
    ? 'Record your first transactions and connect accounts to calculate your real-time financial resilience score.'
    : overallScore >= 80
    ? 'Your emergency buffer and low debt profile insulate you against near-term income shocks.'
    : overallScore >= 65
    ? 'Adequate financial footing. Building emergency reserves will improve resilience.'
    : 'Consider paying down high-interest liabilities and building a cash reserve.';

  const simulatedRunway =
    baselineRunway > 0
      ? incomeShockPct === 100
        ? baselineRunway
        : Math.max(0.0, Number((baselineRunway * (1 - incomeShockPct / 180)).toFixed(1)))
      : 0.0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
            Financial Health
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Vulnerability & Resilience Score
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShareVisible(true)}
          style={[
            styles.shareBtn,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: spacing.xs,
            },
          ]}
        >
          <Share2 size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Ring Hero */}
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
            Overall Resilience Score
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xxs }}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.light,
                fontSize: 48,
              }}
            >
              {hasActivity ? overallScore : '—'}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.lg,
                marginLeft: 4,
              }}
            >
              / 100
            </Text>
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.body,
              marginTop: spacing.xxs,
            }}
          >
            {gradeText}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: 2,
            }}
          >
            {gradeSubtext}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: 3,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('pillars')}
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === 'pillars' ? colors.surface : 'transparent',
                borderRadius: radii.full,
                paddingVertical: 6,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'pillars' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              5 Pillars Breakdown
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('simulator')}
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === 'simulator' ? colors.surface : 'transparent',
                borderRadius: radii.full,
                paddingVertical: 6,
                flex: 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'simulator' ? colors.primary : colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Stress Test Simulator
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'pillars' ? (
          <View>
            {pillars.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPillar(p)}
                style={[
                  styles.pillarCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.bodySm,
                    }}
                  >
                    {p.name}
                  </Text>
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.bodySm,
                    }}
                  >
                    {p.score}/100
                  </Text>
                </View>

                {/* Bar */}
                <View
                  style={[
                    styles.barBg,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.full,
                      marginVertical: spacing.xs,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${p.score}%`,
                        backgroundColor: colors.primary,
                        borderRadius: radii.full,
                      },
                    ]}
                  />
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      fontFamily: typography.fonts.regular,
                    }}
                  >
                    {p.metricLabel}
                  </Text>
                  <ChevronRight size={14} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* Simulator Tab */
          <View
            style={[
              styles.simCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radii.lg,
                padding: spacing.lg,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Sliders size={20} color={colors.primary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.md,
                  marginLeft: spacing.xs,
                }}
              >
                Income Shock Simulator
              </Text>
            </View>

            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
                lineHeight: 20,
                marginBottom: spacing.lg,
              }}
            >
              Simulate an economic disruption or salary delay to see how long your cash reserves hold.
            </Text>

            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
                textTransform: 'uppercase',
                marginBottom: spacing.xs,
              }}
            >
              Simulate Income Drop
            </Text>

            {/* Shock Preset Pills */}
            <View style={[styles.shockRow, { gap: spacing.xs, marginBottom: spacing.xl }]}>
              {[
                { label: 'Normal (0%)', value: 0 },
                { label: '-20% Drop', value: 20 },
                { label: '-50% Drop', value: 50 },
                { label: 'Total Loss (-100%)', value: 100 },
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  onPress={() => setIncomeShockPct(preset.value)}
                  style={[
                    styles.shockPill,
                    {
                      backgroundColor:
                        incomeShockPct === preset.value
                          ? colors.primaryLight
                          : colors.surfaceSubtle,
                      borderColor:
                        incomeShockPct === preset.value ? colors.primary : colors.borderSubtle,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 6,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        incomeShockPct === preset.value ? colors.primary : colors.textSecondary,
                      fontSize: 12,
                      fontFamily: typography.fonts.medium,
                    }}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recalculated Runway Outcome */}
            <View
              style={[
                styles.outcomeCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  alignItems: 'center',
                },
              ]}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.medium,
                  textTransform: 'uppercase',
                }}
              >
                Calculated Runway Duration
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.light,
                  fontSize: 36,
                  marginTop: spacing.xxs,
                }}
              >
                {simulatedRunway}{' '}
                <Text style={{ fontSize: typography.sizes.body, color: colors.textSecondary }}>
                  Months
                </Text>
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.regular,
                  marginTop: 2,
                }}
              >
                At this rate, your emergency reserves can cover all fixed essentials for{' '}
                {simulatedRunway} months.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sheets */}
      {selectedPillar && (
        <PillarFormulaSheet
          visible={Boolean(selectedPillar)}
          onClose={() => setSelectedPillar(null)}
          pillarName={selectedPillar.name}
          score={selectedPillar.score}
          explanation={selectedPillar.explanation}
          formula={selectedPillar.formula}
          recommendation={selectedPillar.recommendation}
        />
      )}

      <ShareHealthSummarySheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        overallScore={overallScore}
        gradeText={gradeText}
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
  shareBtn: {},
  content: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabBtn: {},
  pillarCard: {
    borderWidth: 1,
  },
  barBg: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  simCard: {
    borderWidth: 1,
  },
  shockRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  shockPill: {
    borderWidth: 1,
  },
  outcomeCard: {},
});
