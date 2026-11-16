import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  CategoryDefinition,
  EXPENSE_TAXONOMY,
  INCOME_TAXONOMY,
} from '../../data/categoriesTaxonomy';
import { openKeyValue } from '../../data/kv';

export interface CategoryOption {
  label: string;
  value: string;
  subtitle?: string;
}

export interface CategoryPreferencesContextType {
  enabledExpenseIds: string[];
  enabledIncomeIds: string[];
  enabledSubcategories: Record<string, string[]>;
  allExpenseCategories: CategoryDefinition[];
  allIncomeCategories: CategoryDefinition[];
  activeExpenseCategories: CategoryDefinition[];
  activeIncomeCategories: CategoryDefinition[];
  toggleExpenseCategory: (id: string) => void;
  toggleIncomeCategory: (id: string) => void;
  setExpenseCategories: (ids: string[]) => void;
  setIncomeCategories: (ids: string[]) => void;
  toggleSubcategory: (categoryId: string, subcategory: string) => void;
  selectAllSubcategories: (categoryId: string) => void;
  deselectAllSubcategories: (categoryId: string) => void;
  isSubcategoryEnabled: (categoryId: string, subcategory: string) => boolean;
  isExpenseEnabled: (idOrName: string) => boolean;
  isIncomeEnabled: (idOrName: string) => boolean;
  getExpenseOptions: () => CategoryOption[];
  getIncomeOptions: () => CategoryOption[];
  getSubcategoriesForExpense: (categoryName: string) => string[];
  getSubcategoriesForIncome: (categoryName: string) => string[];
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
}

const CategoryPreferencesContext = createContext<CategoryPreferencesContextType | null>(null);

const STORAGE_KEY_EXPENSE = 'pref:expense_categories_v1';
const STORAGE_KEY_INCOME = 'pref:income_categories_v1';
const STORAGE_KEY_SUBCATEGORIES = 'pref:subcategories_v1';

// Build initial default subcategories mapping (all enabled by default)
const getDefaultSubcategoriesMap = (): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  [...EXPENSE_TAXONOMY, ...INCOME_TAXONOMY].forEach((cat) => {
    map[cat.id] = [...cat.subcategories];
  });
  return map;
};

export function CategoryPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [enabledExpenseIds, setEnabledExpenseIds] = useState<string[]>(() =>
    EXPENSE_TAXONOMY.filter((c) => c.defaultActive).map((c) => c.id)
  );

  const [enabledIncomeIds, setEnabledIncomeIds] = useState<string[]>(() =>
    INCOME_TAXONOMY.filter((c) => c.defaultActive).map((c) => c.id)
  );

  const [enabledSubcategories, setEnabledSubcategories] = useState<Record<string, string[]>>(() =>
    getDefaultSubcategoriesMap()
  );

  const [isLoading, setIsLoading] = useState(true);

  // Load from persistent storage on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const kv = openKeyValue('myledja');
        const storedExpenses = await kv.get(STORAGE_KEY_EXPENSE);
        const storedIncomes = await kv.get(STORAGE_KEY_INCOME);
        const storedSubcategories = await kv.get(STORAGE_KEY_SUBCATEGORIES);

        if (storedExpenses) {
          const parsed = JSON.parse(storedExpenses);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEnabledExpenseIds(parsed);
          }
        }
        if (storedIncomes) {
          const parsed = JSON.parse(storedIncomes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEnabledIncomeIds(parsed);
          }
        }
        if (storedSubcategories) {
          const parsed = JSON.parse(storedSubcategories);
          if (parsed && typeof parsed === 'object') {
            setEnabledSubcategories((prev) => ({
              ...prev,
              ...parsed,
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to load category preferences from storage', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const saveExpenseIds = async (ids: string[]) => {
    setEnabledExpenseIds(ids);
    try {
      const kv = openKeyValue('myledja');
      await kv.set([[STORAGE_KEY_EXPENSE, JSON.stringify(ids)]]);
    } catch (err) {
      console.warn('Failed to persist expense category preferences', err);
    }
  };

  const saveIncomeIds = async (ids: string[]) => {
    setEnabledIncomeIds(ids);
    try {
      const kv = openKeyValue('myledja');
      await kv.set([[STORAGE_KEY_INCOME, JSON.stringify(ids)]]);
    } catch (err) {
      console.warn('Failed to persist income category preferences', err);
    }
  };

  const saveSubcategories = async (map: Record<string, string[]>) => {
    setEnabledSubcategories(map);
    try {
      const kv = openKeyValue('myledja');
      await kv.set([[STORAGE_KEY_SUBCATEGORIES, JSON.stringify(map)]]);
    } catch (err) {
      console.warn('Failed to persist subcategory preferences', err);
    }
  };

  const toggleExpenseCategory = (id: string) => {
    const next = enabledExpenseIds.includes(id)
      ? enabledExpenseIds.filter((item) => item !== id)
      : [...enabledExpenseIds, id];
    if (next.length > 0) {
      saveExpenseIds(next);
    }
  };

  const toggleIncomeCategory = (id: string) => {
    const next = enabledIncomeIds.includes(id)
      ? enabledIncomeIds.filter((item) => item !== id)
      : [...enabledIncomeIds, id];
    if (next.length > 0) {
      saveIncomeIds(next);
    }
  };

  const setExpenseCategories = (ids: string[]) => {
    if (ids.length > 0) {
      saveExpenseIds(ids);
    }
  };

  const setIncomeCategories = (ids: string[]) => {
    if (ids.length > 0) {
      saveIncomeIds(ids);
    }
  };

  const toggleSubcategory = (categoryId: string, subcategory: string) => {
    const currentSubs = enabledSubcategories[categoryId] ?? [];
    const nextSubs = currentSubs.includes(subcategory)
      ? currentSubs.filter((s) => s !== subcategory)
      : [...currentSubs, subcategory];

    const nextMap = {
      ...enabledSubcategories,
      [categoryId]: nextSubs,
    };
    saveSubcategories(nextMap);
  };

  const selectAllSubcategories = (categoryId: string) => {
    const cat = [...EXPENSE_TAXONOMY, ...INCOME_TAXONOMY].find((c) => c.id === categoryId);
    if (!cat) return;
    const nextMap = {
      ...enabledSubcategories,
      [categoryId]: [...cat.subcategories],
    };
    saveSubcategories(nextMap);
  };

  const deselectAllSubcategories = (categoryId: string) => {
    const nextMap = {
      ...enabledSubcategories,
      [categoryId]: [],
    };
    saveSubcategories(nextMap);
  };

  const isSubcategoryEnabled = (categoryId: string, subcategory: string): boolean => {
    const currentSubs = enabledSubcategories[categoryId];
    if (!currentSubs) return true; // Default to true if not configured
    return currentSubs.includes(subcategory);
  };

  const resetToDefaults = async () => {
    const defaultExp = EXPENSE_TAXONOMY.filter((c) => c.defaultActive).map((c) => c.id);
    const defaultInc = INCOME_TAXONOMY.filter((c) => c.defaultActive).map((c) => c.id);
    const defaultSubs = getDefaultSubcategoriesMap();
    await saveExpenseIds(defaultExp);
    await saveIncomeIds(defaultInc);
    await saveSubcategories(defaultSubs);
  };

  const activeExpenseCategories = useMemo(
    () => EXPENSE_TAXONOMY.filter((c) => enabledExpenseIds.includes(c.id)),
    [enabledExpenseIds]
  );

  const activeIncomeCategories = useMemo(
    () => INCOME_TAXONOMY.filter((c) => enabledIncomeIds.includes(c.id)),
    [enabledIncomeIds]
  );

  const isExpenseEnabled = (idOrName: string) =>
    activeExpenseCategories.some((c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase());

  const isIncomeEnabled = (idOrName: string) =>
    activeIncomeCategories.some((c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase());

  const getExpenseOptions = (): CategoryOption[] => {
    return activeExpenseCategories.map((c) => {
      const activeSubs = enabledSubcategories[c.id] ?? c.subcategories;
      const subtitleText =
        activeSubs.length > 0
          ? activeSubs.slice(0, 3).join(', ') + (activeSubs.length > 3 ? '...' : '')
          : 'General';
      return {
        label: c.name,
        value: c.name,
        subtitle: subtitleText,
      };
    });
  };

  const getIncomeOptions = (): CategoryOption[] => {
    return activeIncomeCategories.map((c) => {
      const activeSubs = enabledSubcategories[c.id] ?? c.subcategories;
      const subtitleText =
        activeSubs.length > 0
          ? activeSubs.slice(0, 3).join(', ') + (activeSubs.length > 3 ? '...' : '')
          : 'General';
      return {
        label: c.name,
        value: c.name,
        subtitle: subtitleText,
      };
    });
  };

  const getSubcategoriesForExpense = (categoryName: string): string[] => {
    const found = EXPENSE_TAXONOMY.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
    if (!found) return [];
    const activeSubs = enabledSubcategories[found.id];
    return activeSubs !== undefined ? activeSubs : found.subcategories;
  };

  const getSubcategoriesForIncome = (categoryName: string): string[] => {
    const found = INCOME_TAXONOMY.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
    if (!found) return [];
    const activeSubs = enabledSubcategories[found.id];
    return activeSubs !== undefined ? activeSubs : found.subcategories;
  };

  const value = {
    enabledExpenseIds,
    enabledIncomeIds,
    enabledSubcategories,
    allExpenseCategories: EXPENSE_TAXONOMY,
    allIncomeCategories: INCOME_TAXONOMY,
    activeExpenseCategories,
    activeIncomeCategories,
    toggleExpenseCategory,
    toggleIncomeCategory,
    setExpenseCategories,
    setIncomeCategories,
    toggleSubcategory,
    selectAllSubcategories,
    deselectAllSubcategories,
    isSubcategoryEnabled,
    isExpenseEnabled,
    isIncomeEnabled,
    getExpenseOptions,
    getIncomeOptions,
    getSubcategoriesForExpense,
    getSubcategoriesForIncome,
    resetToDefaults,
    isLoading,
  };

  return (
    <CategoryPreferencesContext.Provider value={value}>
      {children}
    </CategoryPreferencesContext.Provider>
  );
}

export function useCategoryPreferences(): CategoryPreferencesContextType {
  const ctx = useContext(CategoryPreferencesContext);
  if (!ctx) {
    const defaultSubs = getDefaultSubcategoriesMap();
    return {
      enabledExpenseIds: EXPENSE_TAXONOMY.filter((c) => c.defaultActive).map((c) => c.id),
      enabledIncomeIds: INCOME_TAXONOMY.filter((c) => c.defaultActive).map((c) => c.id),
      enabledSubcategories: defaultSubs,
      allExpenseCategories: EXPENSE_TAXONOMY,
      allIncomeCategories: INCOME_TAXONOMY,
      activeExpenseCategories: EXPENSE_TAXONOMY.filter((c) => c.defaultActive),
      activeIncomeCategories: INCOME_TAXONOMY.filter((c) => c.defaultActive),
      toggleExpenseCategory: () => {},
      toggleIncomeCategory: () => {},
      setExpenseCategories: () => {},
      setIncomeCategories: () => {},
      toggleSubcategory: () => {},
      selectAllSubcategories: () => {},
      deselectAllSubcategories: () => {},
      isSubcategoryEnabled: () => true,
      isExpenseEnabled: () => true,
      isIncomeEnabled: () => true,
      getExpenseOptions: () =>
        EXPENSE_TAXONOMY.filter((c) => c.defaultActive).map((c) => ({
          label: c.name,
          value: c.name,
          subtitle: c.subcategories.slice(0, 3).join(', ') + '...',
        })),
      getIncomeOptions: () =>
        INCOME_TAXONOMY.filter((c) => c.defaultActive).map((c) => ({
          label: c.name,
          value: c.name,
          subtitle: c.subcategories.slice(0, 3).join(', ') + '...',
        })),
      getSubcategoriesForExpense: (name: string) => {
        const found = EXPENSE_TAXONOMY.find((c) => c.name.toLowerCase() === name.toLowerCase());
        return found ? found.subcategories : [];
      },
      getSubcategoriesForIncome: (name: string) => {
        const found = INCOME_TAXONOMY.find((c) => c.name.toLowerCase() === name.toLowerCase());
        return found ? found.subcategories : [];
      },
      resetToDefaults: async () => {},
      isLoading: false,
    };
  }
  return ctx;
}
