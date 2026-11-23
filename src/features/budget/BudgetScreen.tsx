import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
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
import { useFinancialRules } from '../rules/RulesContext';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { STANDARD_FRAMEWORK_PRESETS } from '../../data/rulesModel';
import { formatNaira } from '../../money';
import { openKeyValue } from '../../data/kv';
import { monthOf } from '@/ledger';
import {
  loadBillsFromStorage,
  getMonthlyEquivalentMinor,
  type RecurringBillItem,
} from '../plan/billsModel';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { categoryForTaxonomy, resolveCategoryId, taxonomyFor } from '../categories/catalog';
import { budgetAssignId } from '../../data/workspace/model';
import type { CategoryDefinition } from '../../data/categoriesTaxonomy';
import { monthCodeOf, shiftMonth, thisMonthLabel } from '../../lib/months';


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

  const [currentMonth, setCurrentMonth] = useState(thisMonthLabel);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Live Database Hook
  const { repo, categories: dbCategories, events: dbEvents, assigns: dbAssigns } = useDatabaseData();
  // Budget rows come from the Settings catalogue; spending is recorded against the workspace category.
  // A budget row counts its general line and every subcategory under it.
  const idsOf = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of dbCategories) {
      if (c.deleted) continue;
      const def = taxonomyFor(c);
      if (!def) continue;
      const set = map.get(def.id) ?? new Set<string>();
      set.add(c.id);
      map.set(def.id, set);
    }
    return (def: CategoryDefinition) => map.get(def.id) ?? new Set<string>();
  }, [dbCategories]);

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
  // Per-month plans the person has applied; a month without one starts from the active framework.
  const [monthConfigs, setMonthConfigs] = useState<Record<string, MonthBudgetConfig>>({});

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
        const realBills = loadedBills.filter(
          (b) =>
            !b.id.startsWith('bill-mtn') &&
            !b.id.startsWith('bill-ikeja') &&
            !b.id.startsWith('bill-apple') &&
            !b.id.startsWith('bill-estate')
        );
        setRecurringBills(realBills);
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
      }

      // Calculate real income received from Database events for this income category
      let realReceived = 0n;
      const targetMonthCode = monthCodeOf(currentMonth);

      for (const ev of dbEvents) {
        if (ev.status !== 'posted' || ev.type !== 'income') continue;
        if (monthOf(ev.date) === targetMonthCode) {
          for (const line of ev.lines) {
            // Income lines credit the category, so they carry a negative amount.
            if (idsOf(cat).has(line.ledgerAccountId)) {
              realReceived += line.amountMinor < 0n ? -line.amountMinor : line.amountMinor;
            }
          }
        }
      }

      return {
        id: cat.id,
        name: cat.name,
        expectedMinor: planned,
        receivedMinor: realReceived,
        subcategories: subs,
        subBudgets: saved?.subBudgets,
        isEarmarked: saved?.isEarmarked,
        targetExpenseCategory: saved?.targetExpenseCategory,
      };
    });
  }, [activeIncomeCategories, incomeCategoryConfigs, getSubcategoriesForIncome, dbEvents, currentMonth, idsOf]);

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
        expectedIncomeMinor: 0n,
        frameworkId: activeFramework.id,
        // A tithe is its own pillar in the structures that have one; taking it off the top as well counts it twice.
        titheEnabled: false,
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
          // The amount assigned in the workspace for this month (Welcome, or an earlier edit) wins over the share.
          const general = categoryForTaxonomy(dbCategories, cat);
          const assigned = general ? (dbAssigns.get(budgetAssignId(general.id, monthCodeOf(currentMonth))) ?? 0n) : 0n;
          const basePlanned = assigned > 0n ? assigned : (pillarAllocated * catPct) / 100n;
          const extraEarmark = earmarkMap[cat.name] || 0n;
          const totalPlanned = basePlanned + extraEarmark;

          // Calculate real spent from live database events for this category
          const targetMonthCode = monthCodeOf(currentMonth);

          let realSpent = 0n;
          for (const ev of dbEvents) {
            if (ev.status !== 'posted' || ev.type !== 'expense') continue;
            if (monthOf(ev.date) === targetMonthCode) {
              for (const line of ev.lines) {
                if (idsOf(cat).has(line.ledgerAccountId) && line.amountMinor > 0n) {
                  realSpent += line.amountMinor;
                }
              }
            }
          }
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
            spentMinor: realSpent,
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

        let defaultPlanned = 0n;
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
    dbEvents,
    idsOf,
    dbAssigns,
    dbCategories,
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
    setCurrentMonth((m) => shiftMonth(m, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((m) => shiftMonth(m, 1));
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
        const categoryId = await resolveCategoryId(repo, dbCategories, selectedEnvelope.name, 'expense');
        await repo.setAssigned(categoryId, monthCodeOf(currentMonth), newLimitMinor);
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
          padding: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingBottom: isDesktop ? 60 : 100,
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
          onCoverOverspending={() => setCoverOverspentVisible(true)}
          onOpenSetup={() => setSetupSheetVisible(true)}
          onOpenIncomeBudget={() => setIncomeBudgetVisible(true)}
        />

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
