import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../design';
import { useResponsive } from '../../design/size';
import { Toast } from '../../design/components/Toast';
import { SafeToSpendHero } from './SafeToSpendHero';
import { CategoryEnvelopeRow, type CategoryEnvelope } from './CategoryEnvelopeRow';
import { MoveMoneySheet } from './MoveMoneySheet';
import { CoverOverspendingSheet } from './CoverOverspendingSheet';
import { EditEnvelopeLimitSheet } from './EditEnvelopeLimitSheet';
import { CategoryBudgetsSheet } from './CategoryBudgetsSheet';
import { MonthBudgetSetupSheet, type MonthBudgetConfig, type ExpectedEarmark } from './MonthBudgetSetupSheet';
import { IncomeProgressCard, type IncomeStreamItem } from './IncomeProgressCard';
import { EditIncomeBudgetSheet, type IncomeCategoryConfig } from './EditIncomeBudgetSheet';
import { PlanScreen } from '../plan/PlanScreen';
import { DebtsScreen } from '../debts/DebtsScreen';
import { GoalsScreen } from '../goals/GoalsScreen';
import { useFinancialRules } from '../rules/RulesContext';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { STANDARD_FRAMEWORK_PRESETS } from '../../data/rulesModel';
import { formatNaira } from '../../money';
import { openKeyValue } from '../../data/kv';
import {
  loadBillsFromStorage,
  getMonthlyEquivalentMinor,
  type RecurringBillItem,
} from '../plan/billsModel';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

const STORAGE_KEY_SUB_LIMITS = 'pref:budget_subcategory_limits_v1';
const STORAGE_KEY_INCOME_BUDGETS = 'pref:budget_income_budgets_v1';

export function BudgetScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop } = useResponsive();
  const { activeFramework, frameworkPresets, getCategoryPercentage } = useFinancialRules();
  const {
    activeExpenseCategories,
    activeIncomeCategories,
    getSubcategoriesForExpense,
    getSubcategoriesForIncome,
  } = useCategoryPreferences();

  const [currentMonth, setCurrentMonth] = useState('November 2026');
  const [planningTab, setPlanningTab] = useState<'envelopes' | 'bills' | 'debts' | 'goals'>('envelopes');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Live Database Hook
  const { repo, categories: dbCategories } = useDatabaseData();

  // Sheets State
  const [moveMoneyVisible, setMoveMoneyVisible] = useState(false);
  const [coverOverspentVisible, setCoverOverspentVisible] = useState(false);
  const [editLimitVisible, setEditLimitVisible] = useState(false);
  const [categoryBudgetsVisible, setCategoryBudgetsVisible] = useState(false);
  const [setupSheetVisible, setSetupSheetVisible] = useState(false);
  const [incomeBudgetVisible, setIncomeBudgetVisible] = useState(false);
  const [selectedEnvelope, setSelectedEnvelope] = useState<CategoryEnvelope | null>(null);

  // Income category configs
  const [incomeCategoryConfigs, setIncomeCategoryConfigs] = useState<
    Record<string, IncomeCategoryConfig>
  >({});

  // Month-specific budget structures
  const [monthConfigs, setMonthConfigs] = useState<Record<string, MonthBudgetConfig>>({
    'November 2026': {
      month: 'November 2026',
      expectedIncomeMinor: 100000000n, // ₦1,000,000
      frameworkId: 'user_50_10_10_20_10',
      titheEnabled: true,
      taxEnabled: false,
      earmarkedInflows: [],
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

  // Subcategory custom limits: envId -> subcategoryName -> plannedMinor
  const [subcategoryCustomLimits, setSubcategoryCustomLimits] = useState<
    Record<string, Record<string, bigint>>
  >({});

  // Recurring bills loaded from Plan / KV storage
  const [recurringBills, setRecurringBills] = useState<RecurringBillItem[]>([]);

  // Load stored subcategory limits, income budgets, and recurring bills on mount
  useEffect(() => {
    async function loadStoredData() {
      try {
        const kv = openKeyValue('myledja');
        const storedSub = await kv.get(STORAGE_KEY_SUB_LIMITS);
        if (storedSub) {
          const parsed = JSON.parse(storedSub) as Record<string, Record<string, string>>;
          const restored: Record<string, Record<string, bigint>> = {};
          Object.entries(parsed).forEach(([envId, subMap]) => {
            if (subMap) {
              restored[envId] = {};
              Object.entries(subMap).forEach(([sub, val]) => {
                restored[envId]![sub] = BigInt(val);
              });
            }
          });
          setSubcategoryCustomLimits(restored);
        }

        const storedInc = await kv.get(STORAGE_KEY_INCOME_BUDGETS);
        if (storedInc) {
          const parsed = JSON.parse(storedInc);
          const restoredInc: Record<string, IncomeCategoryConfig> = {};
          Object.entries(parsed).forEach(([id, item]: [string, any]) => {
            const subBudgets: Record<string, bigint> = {};
            if (item.subBudgets) {
              Object.entries(item.subBudgets).forEach(([sub, val]) => {
                subBudgets[sub] = BigInt(val as string);
              });
            }
            restoredInc[id] = {
              id: item.id,
              name: item.name,
              totalPlannedMinor: BigInt(item.totalPlannedMinor || '0'),
              subBudgets,
              isEarmarked: Boolean(item.isEarmarked),
              targetExpenseCategory: item.targetExpenseCategory,
            };
          });
          setIncomeCategoryConfigs(restoredInc);
        }

        const loadedBills = await loadBillsFromStorage();
        setRecurringBills(loadedBills);
      } catch (err) {
        console.warn('Failed to load stored budget limits', err);
      }
    }
    loadStoredData();
  }, []);

  const saveSubcategoryLimits = async (data: Record<string, Record<string, bigint>>) => {
    try {
      const kv = openKeyValue('myledja');
      const serializable: Record<string, Record<string, string>> = {};
      Object.entries(data).forEach(([envId, subMap]) => {
        if (subMap) {
          serializable[envId] = {};
          Object.entries(subMap).forEach(([sub, val]) => {
            serializable[envId]![sub] = val.toString();
          });
        }
      });
      await kv.set([[STORAGE_KEY_SUB_LIMITS, JSON.stringify(serializable)]]);
    } catch (err) {
      console.warn('Failed to save subcategory limits', err);
    }
  };

  const saveIncomeBudgets = async (data: Record<string, IncomeCategoryConfig>) => {
    try {
      const kv = openKeyValue('myledja');
      const serializable: Record<string, any> = {};
      Object.entries(data).forEach(([id, item]) => {
        const subBudgets: Record<string, string> = {};
        Object.entries(item.subBudgets).forEach(([sub, val]) => {
          subBudgets[sub] = val.toString();
        });
        serializable[id] = {
          id: item.id,
          name: item.name,
          totalPlannedMinor: item.totalPlannedMinor.toString(),
          subBudgets,
          isEarmarked: item.isEarmarked,
          targetExpenseCategory: item.targetExpenseCategory,
        };
      });
      await kv.set([[STORAGE_KEY_INCOME_BUDGETS, JSON.stringify(serializable)]]);
    } catch (err) {
      console.warn('Failed to save income budgets', err);
    }
  };

  // Income Streams (from Settings active categories & custom budgets)
  const incomeStreams: IncomeStreamItem[] = useMemo(() => {
    return activeIncomeCategories.map((cat) => {
      const saved = incomeCategoryConfigs[cat.id];
      const subs = getSubcategoriesForIncome(cat.name);

      let planned = 0n;
      if (saved) {
        if (saved.subBudgets && Object.keys(saved.subBudgets).length > 0) {
          planned = Object.values(saved.subBudgets).reduce((sum, v) => sum + v, 0n);
        } else {
          planned = saved.totalPlannedMinor;
        }
      } else {
        if (cat.name.toLowerCase() === 'employment') planned = 70000000n; // ₦700k
        else if (cat.name.toLowerCase() === 'business') planned = 20000000n; // ₦200k
        else if (cat.name.toLowerCase() === 'investments') planned = 10000000n; // ₦100k
      }

      let received = 0n;
      if (cat.name.toLowerCase() === 'employment') received = planned;
      else if (cat.name.toLowerCase() === 'business') received = (planned * 75n) / 100n;
      else if (cat.name.toLowerCase() === 'investments') received = (planned * 50n) / 100n;

      return {
        id: cat.id,
        name: cat.name,
        expectedMinor: planned,
        receivedMinor: received,
        subcategories: subs,
        subBudgets: saved?.subBudgets,
        isEarmarked: saved?.isEarmarked,
        targetExpenseCategory: saved?.targetExpenseCategory,
      };
    });
  }, [activeIncomeCategories, incomeCategoryConfigs, getSubcategoriesForIncome]);

  const { totalIncomeExpectedMinor, totalIncomeReceivedMinor } = useMemo(() => {
    let exp = 0n;
    let rec = 0n;
    incomeStreams.forEach((s) => {
      exp += s.expectedMinor;
      rec += s.receivedMinor;
    });
    return { totalIncomeExpectedMinor: exp, totalIncomeReceivedMinor: rec };
  }, [incomeStreams]);

  // Get or create current month config
  const currentConfig: MonthBudgetConfig = useMemo(() => {
    const raw =
      monthConfigs[currentMonth] || {
        month: currentMonth,
        expectedIncomeMinor: 100000000n,
        frameworkId: activeFramework.id,
        titheEnabled: true,
        taxEnabled: false,
        earmarkedInflows: [],
      };

    return {
      ...raw,
      expectedIncomeMinor:
        totalIncomeExpectedMinor > 0n ? totalIncomeExpectedMinor : raw.expectedIncomeMinor,
    };
  }, [monthConfigs, currentMonth, activeFramework, totalIncomeExpectedMinor]);

  // Active framework for current month
  const activeMonthFramework = useMemo(() => {
    const found =
      frameworkPresets.find((p) => p.id === currentConfig.frameworkId) ||
      STANDARD_FRAMEWORK_PRESETS.find((p) => p.id === currentConfig.frameworkId) ||
      activeFramework;
    return found;
  }, [currentConfig.frameworkId, frameworkPresets, activeFramework]);

  // Map recurring bills by category and subcategory
  const categoryScheduledBillsMap = useMemo(() => {
    const map: Record<string, { totalMinor: bigint; subMap: Record<string, bigint> }> = {};
    recurringBills.forEach((b) => {
      const equiv = getMonthlyEquivalentMinor(b);
      const catKey = b.category.toLowerCase().trim();
      if (!map[catKey]) map[catKey] = { totalMinor: 0n, subMap: {} };
      map[catKey]!.totalMinor += equiv;
      if (b.subcategory) {
        const subKey = b.subcategory.toLowerCase().trim();
        map[catKey]!.subMap[subKey] = (map[catKey]!.subMap[subKey] || 0n) + equiv;
      }
    });
    return map;
  }, [recurringBills]);

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

    // 3. Generate envelopes for each active category from Settings, mapped to its framework pillar
    const list: CategoryEnvelope[] = [];
    const assignedCategoryNames = new Set<string>();

    activeMonthFramework.pillars.forEach((pillar) => {
      const pillarAllocated = (allocatableIncome * BigInt(pillar.percentage)) / 100n;
      const mappedCategoryNames = pillar.mappedExpenseCategories || [];

      // Active categories from Settings that belong to this pillar
      const pillarCategories = activeExpenseCategories.filter((cat) =>
        mappedCategoryNames.some((m) => m.toLowerCase() === cat.name.toLowerCase())
      );

      if (pillarCategories.length > 0) {
        pillarCategories.forEach((cat, idx) => {
          assignedCategoryNames.add(cat.name.toLowerCase());

          // Get category ratio / percentage of pillar
          const defaultShare = Math.floor(100 / pillarCategories.length);
          const catPct = BigInt(getCategoryPercentage(cat.name, defaultShare));
          const basePlanned = (pillarAllocated * catPct) / 100n;
          const extraEarmark = earmarkMap[cat.name] || 0n;
          const totalPlanned = basePlanned + extraEarmark;

          // Realistic mock spent for illustration based on category weight
          const mockSpent = (totalPlanned * BigInt(50 + ((idx * 13) % 40))) / 100n;
          const activeSubs = getSubcategoriesForExpense(cat.name);

          // Scheduled bills from /plan
          const catKey = cat.name.toLowerCase().trim();
          const billInfo = categoryScheduledBillsMap[catKey];
          const scheduledBillsMinor = billInfo ? billInfo.totalMinor : 0n;
          const subScheduledBills: Record<string, bigint> = {};
          if (billInfo?.subMap) {
            activeSubs.forEach((sub) => {
              const val = billInfo.subMap[sub.toLowerCase().trim()];
              if (val) subScheduledBills[sub] = val;
            });
          }

          const envId = `${currentMonth}-${pillar.id}-${cat.id || idx}`;
          const customSubBudgets = subcategoryCustomLimits[envId];
          let envelopePlanned = totalPlanned;

          if (customSubBudgets && Object.keys(customSubBudgets).length > 0) {
            const subSum = Object.values(customSubBudgets).reduce((sum, v) => sum + v, 0n);
            if (subSum > 0n) {
              envelopePlanned = subSum + extraEarmark;
            }
          } else if (envelopeCustomLimits[envId] !== undefined) {
            envelopePlanned = envelopeCustomLimits[envId];
          }

          list.push({
            id: envId,
            name: cat.name,
            group: `${pillar.name} (${pillar.percentage}%)`,
            plannedMinor: envelopePlanned,
            spentMinor: mockSpent,
            subcategories: activeSubs,
            subBudgets: customSubBudgets,
            scheduledBillsMinor,
            subScheduledBills,
          });
        });
      } else {
        // Fallback for pillars with no active categories mapped
        const envId = `${currentMonth}-${pillar.id}`;
        list.push({
          id: envId,
          name: pillar.name,
          group: `${pillar.name} (${pillar.percentage}%)`,
          plannedMinor: envelopeCustomLimits[envId] ?? pillarAllocated,
          spentMinor: 0n,
        });
      }
    });

    // Check for any remaining active categories in Settings not explicitly mapped to a pillar
    const unassignedCategories = activeExpenseCategories.filter(
      (cat) => !assignedCategoryNames.has(cat.name.toLowerCase())
    );

    if (unassignedCategories.length > 0) {
      unassignedCategories.forEach((cat, idx) => {
        const envId = `${currentMonth}-other-${cat.id || idx}`;
        const activeSubs = getSubcategoriesForExpense(cat.name);
        const customSubBudgets = subcategoryCustomLimits[envId];

        const catKey = cat.name.toLowerCase().trim();
        const billInfo = categoryScheduledBillsMap[catKey];
        const scheduledBillsMinor = billInfo ? billInfo.totalMinor : 0n;
        const subScheduledBills: Record<string, bigint> = {};
        if (billInfo?.subMap) {
          activeSubs.forEach((sub) => {
            const val = billInfo.subMap[sub.toLowerCase().trim()];
            if (val) subScheduledBills[sub] = val;
          });
        }

        let defaultPlanned = 2500000n; // ₦25,000 default buffer
        if (customSubBudgets && Object.keys(customSubBudgets).length > 0) {
          const subSum = Object.values(customSubBudgets).reduce((sum, v) => sum + v, 0n);
          if (subSum > 0n) defaultPlanned = subSum;
        } else if (envelopeCustomLimits[envId] !== undefined) {
          defaultPlanned = envelopeCustomLimits[envId];
        }

        list.push({
          id: envId,
          name: cat.name,
          group: 'Additional Active Categories',
          plannedMinor: defaultPlanned,
          spentMinor: 0n,
          subcategories: activeSubs,
          subBudgets: customSubBudgets,
          scheduledBillsMinor,
          subScheduledBills,
        });
      });
    }

    return list;
  }, [
    currentMonth,
    currentConfig,
    activeMonthFramework,
    envelopeCustomLimits,
    activeExpenseCategories,
    getCategoryPercentage,
    subcategoryCustomLimits,
    categoryScheduledBillsMap,
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
  const handleSaveLimit = async (
    id: string,
    newLimitMinor: bigint,
    subcategoryLimits?: Record<string, bigint>
  ) => {
    setEnvelopeCustomLimits((prev) => ({
      ...prev,
      [id]: newLimitMinor,
    }));
    if (subcategoryLimits && Object.keys(subcategoryLimits).length > 0) {
      setSubcategoryCustomLimits((prev) => {
        const next = { ...prev, [id]: subcategoryLimits };
        saveSubcategoryLimits(next);
        return next;
      });
    }

    if (repo && selectedEnvelope) {
      try {
        const cat = dbCategories.find(
          (c) => c.name.toLowerCase() === selectedEnvelope.name.toLowerCase()
        );
        if (cat) {
          await repo.setAssigned(cat.id, '2026-11', newLimitMinor);
        }
      } catch (err) {
        console.warn('Failed to assign category limit in DB:', err);
      }
    }

    setToastMessage('Saved envelope planned amount to Database');
    setToastVisible(true);
  };

  // Handle Save Income Budgets
  const handleSaveIncomeBudgets = (
    totalExpectedMinor: bigint,
    budgets: Record<string, IncomeCategoryConfig>
  ) => {
    setIncomeCategoryConfigs(budgets);
    saveIncomeBudgets(budgets);

    const updatedEarmarks: ExpectedEarmark[] = [];
    Object.values(budgets).forEach((b) => {
      if (b.isEarmarked && b.targetExpenseCategory && b.totalPlannedMinor > 0n) {
        updatedEarmarks.push({
          id: `earmark-${b.id}`,
          name: `${b.name} Earmark`,
          amountMinor: b.totalPlannedMinor,
          targetCategory: b.targetExpenseCategory,
        });
      }
    });

    setMonthConfigs((prev) => ({
      ...prev,
      [currentMonth]: {
        ...currentConfig,
        expectedIncomeMinor:
          totalExpectedMinor > 0n ? totalExpectedMinor : currentConfig.expectedIncomeMinor,
        earmarkedInflows:
          updatedEarmarks.length > 0 ? updatedEarmarks : currentConfig.earmarkedInflows,
      },
    }));

    setToastMessage(`Updated expected income (${formatNaira(totalExpectedMinor)})`);
    setToastVisible(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: isDesktop ? spacing.md : spacing.md,
          paddingHorizontal: isDesktop ? spacing.xl : spacing.md,
          paddingBottom: isDesktop ? 40 : 80,
          width: '100%',
          maxWidth: isDesktop ? 1040 : undefined,
          alignSelf: isDesktop ? 'center' : undefined,
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
          onCoverOverspending={() => setCoverOverspentVisible(true)}
          onOpenSetup={() => setSetupSheetVisible(true)}
          onOpenIncomeBudget={() => setIncomeBudgetVisible(true)}
        />

        {/* Planning Hub Unified Segmented Switcher */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.full,
            padding: 3,
            marginVertical: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          {[
            { id: 'envelopes', label: 'Envelopes' },
            { id: 'bills', label: 'Bills & Plans' },
            { id: 'debts', label: 'Debts & Loans' },
            { id: 'goals', label: 'Savings Goals' },
          ].map((tab) => {
            const isActive = planningTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setPlanningTab(tab.id as any)}
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

        {/* Tab 1: Category Envelopes */}
        {planningTab === 'envelopes' && (
          <View>
            {/* 2. Expected Income Streams Card (Collapsible) */}
            <IncomeProgressCard
              streams={incomeStreams}
              totalExpectedMinor={currentConfig.expectedIncomeMinor}
              totalReceivedMinor={totalIncomeReceivedMinor}
              onOpenEditIncome={() => setIncomeBudgetVisible(true)}
            />

            {/* 3. Grouped Category Envelopes (Directly organized by active monthly framework pillars) */}
            {groups.map(([groupName, groupEnvelopes]) => (
              <View key={groupName} style={[styles.groupSection, { marginBottom: spacing.md }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text
                    style={[
                      styles.groupTitle,
                      {
                        color: colors.textSecondary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: 11,
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
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.lg,
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
          </View>
        )}

        {/* Tab 2: Bills & Recurring Plans */}
        {planningTab === 'bills' && <PlanScreen showHeader={false} />}

        {/* Tab 3: Debts & Loans */}
        {planningTab === 'debts' && <DebtsScreen showHeader={false} />}

        {/* Tab 4: Savings Goals */}
        {planningTab === 'goals' && <GoalsScreen showHeader={false} />}
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
        subcategories={
          selectedEnvelope
            ? (selectedEnvelope.subcategories && selectedEnvelope.subcategories.length > 0
                ? selectedEnvelope.subcategories
                : getSubcategoriesForExpense(selectedEnvelope.name))
            : []
        }
        currentSubBudgets={
          selectedEnvelope ? subcategoryCustomLimits[selectedEnvelope.id] : undefined
        }
        onSaveLimit={handleSaveLimit}
      />

      <CategoryBudgetsSheet
        visible={categoryBudgetsVisible}
        onClose={() => setCategoryBudgetsVisible(false)}
        envelopes={envelopes}
        expectedIncomeMinor={currentConfig.expectedIncomeMinor}
        onSaveBudgets={(updatedLimits) => {
          setEnvelopeCustomLimits((prev) => ({
            ...prev,
            ...updatedLimits,
          }));
          setToastMessage('Saved category budgets successfully');
          setToastVisible(true);
        }}
      />

      <EditIncomeBudgetSheet
        visible={incomeBudgetVisible}
        onClose={() => setIncomeBudgetVisible(false)}
        activeIncomeCategories={activeIncomeCategories}
        currentIncomeBudgets={incomeCategoryConfigs}
        onSaveIncomeBudgets={handleSaveIncomeBudgets}
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
