import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  AllocationFramework,
  AllocationPillar,
  TaxRuleConfig,
  TitheRuleConfig,
  EarmarkedRule,
  SubAllocationConfig,
  SubAllocationItem,
  PRESET_USER_50_10_10_20_10,
  STANDARD_FRAMEWORK_PRESETS,
} from '../../data/rulesModel';
import { openKeyValue } from '../../data/kv';

export interface InflowSimulationResult {
  isEarmarked: boolean;
  earmarkedRule: EarmarkedRule | null;
  grossAmountMinor: bigint;
  taxAmountMinor: bigint;
  titheAmountMinor: bigint;
  netAllocatableMinor: bigint;
  pillarAllocations: {
    pillar: AllocationPillar;
    allocatedMinor: bigint;
  }[];
}

export interface RulesContextType {
  activeFramework: AllocationFramework;
  frameworkPresets: AllocationFramework[];
  taxRule: TaxRuleConfig;
  titheRule: TitheRuleConfig;
  earmarkedRules: EarmarkedRule[];
  subAllocation: SubAllocationConfig;
  applyPresetFramework: (presetId: string) => void;
  updatePillarPercentage: (pillarId: string, newPercentage: number) => void;
  updateTaxRule: (updates: Partial<TaxRuleConfig>) => void;
  updateTitheRule: (updates: Partial<TitheRuleConfig>) => void;
  addEarmarkedRule: (rule: Omit<EarmarkedRule, 'id'>) => void;
  toggleEarmarkedRule: (id: string) => void;
  deleteEarmarkedRule: (id: string) => void;
  updateSubAllocations: (items: SubAllocationConfig['items']) => void;
  setCategorySubAllocation: (categoryName: string, percentage: number) => void;
  setSubcategoryAllocation: (categoryName: string, subName: string, percentage: number) => void;
  autoBalanceCategories: (categoryNames: string[]) => void;
  getCategoryPercentage: (categoryName: string, fallbackPct?: number) => number;
  resetRulesToDefault: () => Promise<void>;
  simulateInflow: (
    amountMinor: bigint,
    incomeCategory?: string,
    notesOrPayee?: string
  ) => InflowSimulationResult;
  isTotal100Percent: boolean;
  totalPercentage: number;
}

const RulesContext = createContext<RulesContextType | null>(null);

const STORAGE_KEY_RULES = 'pref:financial_rules_v1';

const DEFAULT_TAX_RULE: TaxRuleConfig = {
  enabled: false,
  ratePercentage: 10,
  targetAccountType: 'bills',
  exemptIncomeCategories: ['Employment', 'Gifts', 'Government'],
};

const DEFAULT_TITHE_RULE: TitheRuleConfig = {
  enabled: true,
  ratePercentage: 10,
  base: 'gross',
  targetEnvelope: 'Spiritual & Religious',
};

const DEFAULT_EARMARKED_RULES: EarmarkedRule[] = [
  {
    id: 'em-1',
    name: 'Rent Assistance Gift',
    triggerType: 'keyword',
    triggerValue: 'Rent',
    targetCategory: 'Housing',
    targetAccountType: 'bills',
    passThroughPercentage: 100,
    active: true,
  },
  {
    id: 'em-2',
    name: 'Direct Project Funding',
    triggerType: 'income_category',
    triggerValue: 'Business',
    targetCategory: 'Business & Professional',
    targetAccountType: 'project',
    passThroughPercentage: 100,
    active: false,
  },
];

const DEFAULT_CATEGORY_PERCENTAGES: Record<string, number> = {
  Housing: 35,
  Food: 30,
  Transportation: 15,
  Utilities: 12,
  Healthcare: 5,
  'Personal Care': 3,
};

const DEFAULT_SUB_ALLOCATION: SubAllocationConfig = {
  enabled: true,
  parentPillarId: 'living_needs',
  categoryPercentages: DEFAULT_CATEGORY_PERCENTAGES,
  subcategoryPercentages: {},
  items: [
    { id: 'sub-housing', categoryName: 'Housing', percentageOfPillar: 35 },
    { id: 'sub-food', categoryName: 'Food', percentageOfPillar: 30 },
    { id: 'sub-transport', categoryName: 'Transportation', percentageOfPillar: 15 },
    { id: 'sub-utilities', categoryName: 'Utilities', percentageOfPillar: 12 },
    { id: 'sub-health', categoryName: 'Healthcare', percentageOfPillar: 5 },
    { id: 'sub-personal', categoryName: 'Personal Care', percentageOfPillar: 3 },
  ],
};

export function RulesProvider({ children }: { children: React.ReactNode }) {
  const [activeFramework, setActiveFramework] = useState<AllocationFramework>(PRESET_USER_50_10_10_20_10);
  const [taxRule, setTaxRule] = useState<TaxRuleConfig>(DEFAULT_TAX_RULE);
  const [titheRule, setTitheRule] = useState<TitheRuleConfig>(DEFAULT_TITHE_RULE);
  const [earmarkedRules, setEarmarkedRules] = useState<EarmarkedRule[]>(DEFAULT_EARMARKED_RULES);
  const [subAllocation, setSubAllocation] = useState<SubAllocationConfig>(DEFAULT_SUB_ALLOCATION);

  // Load from persistent storage on mount
  useEffect(() => {
    async function loadRules() {
      try {
        const kv = openKeyValue('myledja');
        const stored = await kv.get(STORAGE_KEY_RULES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.activeFramework) setActiveFramework(parsed.activeFramework);
          if (parsed.taxRule) setTaxRule(parsed.taxRule);
          if (parsed.titheRule) setTitheRule(parsed.titheRule);
          if (parsed.earmarkedRules) setEarmarkedRules(parsed.earmarkedRules);
          if (parsed.subAllocation) setSubAllocation(parsed.subAllocation);
        }
      } catch (err) {
        console.warn('Failed to load financial rules from storage', err);
      }
    }
    loadRules();
  }, []);

  const saveState = async (
    fw = activeFramework,
    tax = taxRule,
    tithe = titheRule,
    earmarked = earmarkedRules,
    sub = subAllocation
  ) => {
    try {
      const kv = openKeyValue('myledja');
      await kv.set([
        [
          STORAGE_KEY_RULES,
          JSON.stringify({
            activeFramework: fw,
            taxRule: tax,
            titheRule: tithe,
            earmarkedRules: earmarked,
            subAllocation: sub,
          }),
        ],
      ]);
    } catch (err) {
      console.warn('Failed to persist financial rules', err);
    }
  };

  const applyPresetFramework = (presetId: string) => {
    const found = STANDARD_FRAMEWORK_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setActiveFramework(found);
      saveState(found);
    }
  };

  const updatePillarPercentage = (pillarId: string, newPercentage: number) => {
    const updatedPillars = activeFramework.pillars.map((p) =>
      p.id === pillarId ? { ...p, percentage: Math.max(0, Math.min(100, newPercentage)) } : p
    );
    const updatedFramework: AllocationFramework = {
      ...activeFramework,
      id: 'custom_framework',
      name: 'Custom Allocation Framework',
      pillars: updatedPillars,
    };
    setActiveFramework(updatedFramework);
    saveState(updatedFramework);
  };

  const updateTaxRule = (updates: Partial<TaxRuleConfig>) => {
    setTaxRule((prev) => {
      const next = { ...prev, ...updates };
      saveState(activeFramework, next);
      return next;
    });
  };

  const updateTitheRule = (updates: Partial<TitheRuleConfig>) => {
    setTitheRule((prev) => {
      const next = { ...prev, ...updates };
      saveState(activeFramework, taxRule, next);
      return next;
    });
  };

  const addEarmarkedRule = (rule: Omit<EarmarkedRule, 'id'>) => {
    const newRule: EarmarkedRule = {
      ...rule,
      id: `em-${Date.now()}`,
    };
    setEarmarkedRules((prev) => {
      const next = [newRule, ...prev];
      saveState(activeFramework, taxRule, titheRule, next);
      return next;
    });
  };

  const toggleEarmarkedRule = (id: string) => {
    setEarmarkedRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r));
      saveState(activeFramework, taxRule, titheRule, next);
      return next;
    });
  };

  const deleteEarmarkedRule = (id: string) => {
    setEarmarkedRules((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveState(activeFramework, taxRule, titheRule, next);
      return next;
    });
  };

  const updateSubAllocations = (items: SubAllocationConfig['items']) => {
    setSubAllocation((prev) => {
      const next = { ...prev, items };
      saveState(activeFramework, taxRule, titheRule, earmarkedRules, next);
      return next;
    });
  };

  const getCategoryPercentage = (categoryName: string, fallbackPct = 0): number => {
    if (subAllocation.categoryPercentages && subAllocation.categoryPercentages[categoryName] !== undefined) {
      return subAllocation.categoryPercentages[categoryName];
    }
    const foundItem = subAllocation.items?.find(
      (it) => it.categoryName.toLowerCase() === categoryName.toLowerCase()
    );
    if (foundItem) return foundItem.percentageOfPillar;
    return DEFAULT_CATEGORY_PERCENTAGES[categoryName] ?? fallbackPct;
  };

  const setCategorySubAllocation = (categoryName: string, percentage: number) => {
    setSubAllocation((prev) => {
      const currentMap = {
        ...DEFAULT_CATEGORY_PERCENTAGES,
        ...(prev.categoryPercentages || {}),
      };
      currentMap[categoryName] = Math.max(0, Math.min(100, Math.round(percentage)));

      const existingItems = prev.items || [];
      const itemIdx = existingItems.findIndex(
        (it) => it.categoryName.toLowerCase() === categoryName.toLowerCase()
      );
      let updatedItems = [...existingItems];
      if (itemIdx >= 0 && existingItems[itemIdx]) {
        const current = existingItems[itemIdx]!;
        updatedItems[itemIdx] = {
          ...current,
          percentageOfPillar: currentMap[categoryName],
        };
      } else {
        updatedItems.push({
          id: `sub-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
          categoryName,
          percentageOfPillar: currentMap[categoryName],
        });
      }

      const next: SubAllocationConfig = {
        ...prev,
        categoryPercentages: currentMap,
        items: updatedItems,
      };
      saveState(activeFramework, taxRule, titheRule, earmarkedRules, next);
      return next;
    });
  };

  const setSubcategoryAllocation = (categoryName: string, subName: string, percentage: number) => {
    setSubAllocation((prev) => {
      const subMap = { ...(prev.subcategoryPercentages || {}) };
      const catSubs = { ...(subMap[categoryName] || {}) };
      catSubs[subName] = Math.max(0, Math.min(100, Math.round(percentage)));
      subMap[categoryName] = catSubs;

      const next: SubAllocationConfig = {
        ...prev,
        subcategoryPercentages: subMap,
      };
      saveState(activeFramework, taxRule, titheRule, earmarkedRules, next);
      return next;
    });
  };

  const autoBalanceCategories = (categoryNames: string[]) => {
    if (categoryNames.length === 0) return;
    const count = categoryNames.length;
    const baseShare = Math.floor(100 / count);
    const remainder = 100 - baseShare * count;

    const newMap: Record<string, number> = {};
    const newItems: SubAllocationItem[] = [];

    categoryNames.forEach((catName, idx) => {
      const pct = idx === 0 ? baseShare + remainder : baseShare;
      newMap[catName] = pct;
      newItems.push({
        id: `sub-${catName.toLowerCase().replace(/\s+/g, '-')}`,
        categoryName: catName,
        percentageOfPillar: pct,
      });
    });

    setSubAllocation((prev) => {
      const next: SubAllocationConfig = {
        ...prev,
        categoryPercentages: newMap,
        items: newItems,
      };
      saveState(activeFramework, taxRule, titheRule, earmarkedRules, next);
      return next;
    });
  };

  const resetRulesToDefault = async () => {
    setActiveFramework(PRESET_USER_50_10_10_20_10);
    setTaxRule(DEFAULT_TAX_RULE);
    setTitheRule(DEFAULT_TITHE_RULE);
    setEarmarkedRules(DEFAULT_EARMARKED_RULES);
    setSubAllocation(DEFAULT_SUB_ALLOCATION);
    await saveState(
      PRESET_USER_50_10_10_20_10,
      DEFAULT_TAX_RULE,
      DEFAULT_TITHE_RULE,
      DEFAULT_EARMARKED_RULES,
      DEFAULT_SUB_ALLOCATION
    );
  };

  const totalPercentage = useMemo(
    () => activeFramework.pillars.reduce((sum, p) => sum + p.percentage, 0),
    [activeFramework]
  );

  const isTotal100Percent = totalPercentage === 100;

  // The Core Calculation Engine: Simulates any inflow through the active rules
  const simulateInflow = (
    amountMinor: bigint,
    incomeCategory = 'Employment',
    notesOrPayee = ''
  ): InflowSimulationResult => {
    if (amountMinor <= 0n) {
      return {
        isEarmarked: false,
        earmarkedRule: null,
        grossAmountMinor: 0n,
        taxAmountMinor: 0n,
        titheAmountMinor: 0n,
        netAllocatableMinor: 0n,
        pillarAllocations: activeFramework.pillars.map((p) => ({ pillar: p, allocatedMinor: 0n })),
      };
    }

    // 1. Check for Earmarked Rule match
    const matchedEarmark = earmarkedRules.find((r) => {
      if (!r.active) return false;
      if (r.triggerType === 'income_category') {
        return r.triggerValue.toLowerCase() === incomeCategory.toLowerCase();
      }
      if (r.triggerType === 'keyword') {
        const text = `${notesOrPayee} ${incomeCategory}`.toLowerCase();
        return text.includes(r.triggerValue.toLowerCase());
      }
      return false;
    });

    if (matchedEarmark) {
      // 100% Pass-through directly to target, bypasses percentage splits
      return {
        isEarmarked: true,
        earmarkedRule: matchedEarmark,
        grossAmountMinor: amountMinor,
        taxAmountMinor: 0n,
        titheAmountMinor: 0n,
        netAllocatableMinor: amountMinor,
        pillarAllocations: [
          {
            pillar: {
              id: 'earmarked_target',
              name: `Earmarked: ${matchedEarmark.name}`,
              percentage: 100,
              color: '#3B82F6',
              icon: 'Tag',
              purposeAccountType: matchedEarmark.targetAccountType,
              description: `100% earmarked pass-through to ${matchedEarmark.targetCategory}`,
              mappedExpenseCategories: [matchedEarmark.targetCategory],
            },
            allocatedMinor: amountMinor,
          },
        ],
      };
    }

    // 2. Tax Provision (if enabled and category is not exempt)
    let taxMinor = 0n;
    const isTaxExempt = taxRule.exemptIncomeCategories.some(
      (cat) => cat.toLowerCase() === incomeCategory.toLowerCase()
    );
    if (taxRule.enabled && !isTaxExempt && taxRule.ratePercentage > 0) {
      taxMinor = (amountMinor * BigInt(taxRule.ratePercentage)) / 100n;
    }

    // 3. Tithe Provision (if enabled)
    let titheMinor = 0n;
    if (titheRule.enabled && titheRule.ratePercentage > 0) {
      const titheBase =
        titheRule.base === 'net_after_tax' ? amountMinor - taxMinor : amountMinor;
      titheMinor = (titheBase * BigInt(titheRule.ratePercentage)) / 100n;
    }

    // 4. Net Allocatable Amount
    const netAllocatableMinor = amountMinor - taxMinor - titheMinor;

    // 5. Allocation according to Framework Pillars
    const validTotal = totalPercentage > 0 ? BigInt(totalPercentage) : 100n;
    const pillarAllocations = activeFramework.pillars.map((pillar) => {
      // If pillar is Tithe and we already handled tithe at top of funnel, adjust accordingly
      const pillarShare = (netAllocatableMinor * BigInt(pillar.percentage)) / validTotal;
      return {
        pillar,
        allocatedMinor: pillarShare,
      };
    });

    return {
      isEarmarked: false,
      earmarkedRule: null,
      grossAmountMinor: amountMinor,
      taxAmountMinor: taxMinor,
      titheAmountMinor: titheMinor,
      netAllocatableMinor,
      pillarAllocations,
    };
  };

  const value = {
    activeFramework,
    frameworkPresets: STANDARD_FRAMEWORK_PRESETS,
    taxRule,
    titheRule,
    earmarkedRules,
    subAllocation,
    applyPresetFramework,
    updatePillarPercentage,
    updateTaxRule,
    updateTitheRule,
    addEarmarkedRule,
    toggleEarmarkedRule,
    deleteEarmarkedRule,
    updateSubAllocations,
    setCategorySubAllocation,
    setSubcategoryAllocation,
    autoBalanceCategories,
    getCategoryPercentage,
    resetRulesToDefault,
    simulateInflow,
    isTotal100Percent,
    totalPercentage,
  };

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

export function useFinancialRules(): RulesContextType {
  const ctx = useContext(RulesContext);
  if (!ctx) {
    throw new Error('useFinancialRules must be used within a RulesProvider');
  }
  return ctx;
}
