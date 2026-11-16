import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../design';
import { Toast } from '../../design/components/Toast';
import { SafeToSpendHero } from './SafeToSpendHero';
import { CategoryEnvelopeRow, type CategoryEnvelope } from './CategoryEnvelopeRow';
import { MoveMoneySheet } from './MoveMoneySheet';
import { CoverOverspendingSheet } from './CoverOverspendingSheet';
import { EditEnvelopeLimitSheet } from './EditEnvelopeLimitSheet';
import { MonthBudgetSetupSheet, type MonthBudgetConfig } from './MonthBudgetSetupSheet';
import { useFinancialRules } from '../rules/RulesContext';
import { STANDARD_FRAMEWORK_PRESETS } from '../../data/rulesModel';
import { formatNaira } from '../../money';

export function BudgetScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const { activeFramework, frameworkPresets } = useFinancialRules();

  const [currentMonth, setCurrentMonth] = useState('November 2026');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Month-specific budget structures
  const [monthConfigs, setMonthConfigs] = useState<Record<string, MonthBudgetConfig>>({
    'November 2026': {
      month: 'November 2026',
      expectedIncomeMinor: 100000000n, // ₦1,000,000
      frameworkId: 'user_50_10_10_20_10',
      titheEnabled: true,
      taxEnabled: false,
      earmarkedInflows: [
        {
          id: 'earmark-nov-1',
          name: 'Rent Contribution Gift',
          amountMinor: 50000000n, // ₦500,000
          targetCategory: 'Housing',
        },
      ],
    },
    'December 2026': {
      month: 'December 2026',
      expectedIncomeMinor: 150000000n, // ₦1,500,000
      frameworkId: 'wealth_builder_70_20_10',
      titheEnabled: true,
      taxEnabled: false,
      earmarkedInflows: [],
    },
    'October 2026': {
      month: 'October 2026',
      expectedIncomeMinor: 95000000n, // ₦950,000
      frameworkId: 'classic_50_30_20',
      titheEnabled: false,
      taxEnabled: false,
      earmarkedInflows: [],
    },
  });

  // Sheets State
  const [moveMoneyVisible, setMoveMoneyVisible] = useState(false);
  const [coverOverspentVisible, setCoverOverspentVisible] = useState(false);
  const [editLimitVisible, setEditLimitVisible] = useState(false);
  const [setupSheetVisible, setSetupSheetVisible] = useState(false);
  const [selectedEnvelope, setSelectedEnvelope] = useState<CategoryEnvelope | null>(null);

  // Get or create current month config
  const currentConfig: MonthBudgetConfig = useMemo(() => {
    return (
      monthConfigs[currentMonth] || {
        month: currentMonth,
        expectedIncomeMinor: 100000000n,
        frameworkId: activeFramework.id,
        titheEnabled: true,
        taxEnabled: false,
        earmarkedInflows: [],
      }
    );
  }, [monthConfigs, currentMonth, activeFramework]);

  // Active framework for current month
  const activeMonthFramework = useMemo(() => {
    const found =
      frameworkPresets.find((p) => p.id === currentConfig.frameworkId) ||
      STANDARD_FRAMEWORK_PRESETS.find((p) => p.id === currentConfig.frameworkId) ||
      activeFramework;
    return found;
  }, [currentConfig.frameworkId, frameworkPresets, activeFramework]);

  // Compute Envelopes dynamically based on current month's framework and expected income
  const [envelopeCustomLimits, setEnvelopeCustomLimits] = useState<Record<string, bigint>>({});

  const envelopes: CategoryEnvelope[] = useMemo(() => {
    const income = currentConfig.expectedIncomeMinor;

    // 1. Off-the-top calculations
    const titheMinor = currentConfig.titheEnabled ? (income * 10n) / 100n : 0n;
    const taxMinor = currentConfig.taxEnabled ? (income * 10n) / 100n : 0n;
    const allocatableIncome = income - titheMinor - taxMinor;

    // 2. Sum of earmarked funds per target category
    const earmarkMap: Record<string, bigint> = {};
    for (const em of currentConfig.earmarkedInflows) {
      earmarkMap[em.targetCategory] = (earmarkMap[em.targetCategory] || 0n) + em.amountMinor;
    }

    // 3. Generate envelopes for each pillar of the selected framework
    const list: CategoryEnvelope[] = [];

    activeMonthFramework.pillars.forEach((pillar) => {
      const pillarAllocated = (allocatableIncome * BigInt(pillar.percentage)) / 100n;

      if (pillar.id === 'living_needs' || pillar.id === 'living' || pillar.id === 'needs' || pillar.id === 'spending') {
        // Sub-divide living into primary categories
        const subShares = [
          { name: 'Housing (Rent & Maintenance)', weight: 35n, spent: 4800000n },
          { name: 'Food & Groceries', weight: 30n, spent: 6450000n },
          { name: 'Transportation & Fuel', weight: 15n, spent: 4100000n },
          { name: 'Electricity & Utilities', weight: 12n, spent: 3500000n },
          { name: 'Healthcare & Personal Care', weight: 8n, spent: 1200000n },
        ];

        subShares.forEach((sub, idx) => {
          const basePlanned = (pillarAllocated * sub.weight) / 100n;
          // Add any earmarked funds for Housing
          const extraEarmark = sub.name.includes('Housing') ? (earmarkMap['Housing'] || 0n) : 0n;
          const totalPlanned = basePlanned + extraEarmark;

          const envId = `${currentMonth}-${pillar.id}-${idx}`;
          list.push({
            id: envId,
            name: sub.name,
            group: `${pillar.name} (${pillar.percentage}%)`,
            plannedMinor: envelopeCustomLimits[envId] ?? totalPlanned,
            spentMinor: BigInt(sub.spent),
          });
        });
      } else if (pillar.id === 'wants') {
        const wantsSubs = [
          { name: 'Dining Out & Takeaway', weight: 45n, spent: 1800000n },
          { name: 'Entertainment & Streaming', weight: 30n, spent: 520000n },
          { name: 'Shopping & Clothing', weight: 25n, spent: 2850000n },
        ];
        wantsSubs.forEach((sub, idx) => {
          const basePlanned = (pillarAllocated * sub.weight) / 100n;
          const envId = `${currentMonth}-${pillar.id}-${idx}`;
          list.push({
            id: envId,
            name: sub.name,
            group: `${pillar.name} (${pillar.percentage}%)`,
            plannedMinor: envelopeCustomLimits[envId] ?? basePlanned,
            spentMinor: BigInt(sub.spent),
          });
        });
      } else {
        // Direct pillar envelopes (Tithe, Emergency, Investments, Charity)
        const envId = `${currentMonth}-${pillar.id}`;
        let mockSpent = 0n;
        if (pillar.id === 'tithe_giving' || pillar.name.includes('Tithe')) {
          mockSpent = (pillarAllocated * 80n) / 100n;
        } else if (pillar.id === 'emergency_savings' || pillar.name.includes('Emergency')) {
          mockSpent = pillarAllocated; // 100% funded
        } else if (pillar.id === 'wealth_investment' || pillar.name.includes('Investment')) {
          mockSpent = (pillarAllocated * 50n) / 100n;
        } else {
          mockSpent = (pillarAllocated * 40n) / 100n;
        }

        list.push({
          id: envId,
          name: pillar.name,
          group: `${pillar.name} (${pillar.percentage}%)`,
          plannedMinor: envelopeCustomLimits[envId] ?? pillarAllocated,
          spentMinor: mockSpent,
        });
      }
    });

    return list;
  }, [
    currentMonth,
    currentConfig,
    activeMonthFramework,
    envelopeCustomLimits,
  ]);

  // Aggregate Totals
  const { totalPlanned, totalSpent, overspentList, fundedList } = useMemo(() => {
    let p = 0n;
    let s = 0n;
    const over: CategoryEnvelope[] = [];
    const funded: CategoryEnvelope[] = [];

    for (const env of envelopes) {
      p += env.plannedMinor;
      s += env.spentMinor;
      if (env.spentMinor > env.plannedMinor) {
        over.push(env);
      } else if (env.plannedMinor > env.spentMinor) {
        funded.push(env);
      }
    }
    return { totalPlanned: p, totalSpent: s, overspentList: over, fundedList: funded };
  }, [envelopes]);

  // Group Envelopes
  const groups = useMemo(() => {
    const map = new Map<string, CategoryEnvelope[]>();
    for (const env of envelopes) {
      const list = map.get(env.group) ?? [];
      list.push(env);
      map.set(env.group, list);
    }
    return Array.from(map.entries());
  }, [envelopes]);

  // Handle Apply from Month Setup Sheet
  const handleApplyMonthConfig = (newConfig: MonthBudgetConfig) => {
    setMonthConfigs((prev) => ({
      ...prev,
      [newConfig.month]: newConfig,
    }));
    setToastMessage(`Updated budget structure for ${newConfig.month}`);
    setToastVisible(true);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 'November 2026') setCurrentMonth('October 2026');
    else if (currentMonth === 'December 2026') setCurrentMonth('November 2026');
  };

  const handleNextMonth = () => {
    if (currentMonth === 'October 2026') setCurrentMonth('November 2026');
    else if (currentMonth === 'November 2026') setCurrentMonth('December 2026');
  };

  // Handle Move Money
  const handleConfirmMove = (fromId: string, toId: string, amountMinor: bigint) => {
    setEnvelopeCustomLimits((prev) => {
      const fromCurr = envelopes.find((e) => e.id === fromId)?.plannedMinor || 0n;
      const toCurr = envelopes.find((e) => e.id === toId)?.plannedMinor || 0n;
      return {
        ...prev,
        [fromId]: fromCurr - amountMinor,
        [toId]: toCurr + amountMinor,
      };
    });
    setToastMessage('Moved budget money successfully');
    setToastVisible(true);
  };

  // Handle Cover Overspent
  const handleCoverOverspent = (overspentId: string, sourceId: string, amountMinor: bigint) => {
    setEnvelopeCustomLimits((prev) => {
      const overCurr = envelopes.find((e) => e.id === overspentId)?.plannedMinor || 0n;
      const sourceCurr = envelopes.find((e) => e.id === sourceId)?.plannedMinor || 0n;
      return {
        ...prev,
        [overspentId]: overCurr + amountMinor,
        [sourceId]: sourceCurr - amountMinor,
      };
    });
    setToastMessage('Covered overspending deficit');
    setToastVisible(true);
  };

  // Handle Update Limit
  const handleSaveLimit = (id: string, newLimitMinor: bigint) => {
    setEnvelopeCustomLimits((prev) => ({
      ...prev,
      [id]: newLimitMinor,
    }));
    setToastMessage('Updated envelope planned amount');
    setToastVisible(true);
  };

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
        {/* 1. Safe to Spend Hero Card */}
        <SafeToSpendHero
          currentMonth={currentMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          totalPlannedMinor={totalPlanned}
          totalSpentMinor={totalSpent}
          expectedIncomeMinor={currentConfig.expectedIncomeMinor}
          frameworkName={activeMonthFramework.name}
          overspentCount={overspentList.length}
          onMoveMoney={() => setMoveMoneyVisible(true)}
          onCoverOverspending={() => setCoverOverspentVisible(true)}
          onOpenSetup={() => setSetupSheetVisible(true)}
        />

        {/* 2. Grouped Category Envelopes (Directly organized by active monthly framework pillars) */}
        {groups.map(([groupName, groupEnvelopes]) => (
          <View key={groupName} style={[styles.groupSection, { marginBottom: spacing.lg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text
                style={[
                  styles.groupTitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.sm,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  },
                ]}
              >
                {groupName}
              </Text>
            </View>

            <View
              style={[
                styles.groupCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.xl,
                },
              ]}
            >
              {groupEnvelopes.map((env) => (
                <CategoryEnvelopeRow
                  key={env.id}
                  envelope={env}
                  onPress={() => {
                    setSelectedEnvelope(env);
                    setEditLimitVisible(true);
                  }}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Popups & Sheets */}
      <MonthBudgetSetupSheet
        visible={setupSheetVisible}
        onClose={() => setSetupSheetVisible(false)}
        currentMonth={currentMonth}
        initialConfig={currentConfig}
        onApplyConfig={handleApplyMonthConfig}
      />

      <MoveMoneySheet
        visible={moveMoneyVisible}
        onClose={() => setMoveMoneyVisible(false)}
        envelopes={envelopes}
        onConfirmMove={handleConfirmMove}
      />

      <CoverOverspendingSheet
        visible={coverOverspentVisible}
        onClose={() => setCoverOverspentVisible(false)}
        overspentEnvelopes={overspentList}
        fundedEnvelopes={fundedList}
        onCover={handleCoverOverspent}
      />

      <EditEnvelopeLimitSheet
        visible={editLimitVisible}
        onClose={() => setEditLimitVisible(false)}
        envelope={selectedEnvelope}
        onSaveLimit={handleSaveLimit}
      />

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        onDismiss={() => setToastVisible(false)}
      />
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
  groupSection: {
    width: '100%',
  },
  groupTitle: {},
  groupCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
