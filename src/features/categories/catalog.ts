import { useEffect, useMemo, useRef } from 'react';

import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, type CategoryDefinition } from '../../data/categoriesTaxonomy';
import type { Category } from '../../data/workspace/model';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { useCategoryPreferences } from './CategoryPreferencesContext';

/**
 * One way in for category pickers.
 *
 * The workspace's categories (synced, with ids) are the source of truth: every transaction, budget line and
 * rule points at one of them by id. The taxonomy only supplies starter names and subcategories, and the
 * Settings preferences only say which taxonomy entries are switched on.
 */

/** Saving and investing are moves between your own accounts, not spending; they get their own flow. */
export const SAVE_OR_INVEST_TAXONOMY_ID = 'exp-savings-investments';
/** Loan and debt repayments reduce what you owe; they get their own flow too. */
export const DEBT_TAXONOMY_ID = 'exp-financial';

const ALL_TAXONOMY = [...EXPENSE_TAXONOMY, ...INCOME_TAXONOMY];

export function taxonomyFor(category: Pick<Category, 'key' | 'name' | 'kind'>): CategoryDefinition | undefined {
  if (category.key) {
    const byKey = ALL_TAXONOMY.find((d) => d.id === category.key);
    if (byKey) return byKey;
  }
  const list = category.kind === 'income' ? INCOME_TAXONOMY : EXPENSE_TAXONOMY;
  const lower = category.name.trim().toLowerCase();
  return list.find((d) => d.name.toLowerCase() === lower);
}

/** The workspace category that stands for a taxonomy entry, if it exists yet. */
export function categoryForTaxonomy(categories: Category[], def: CategoryDefinition): Category | undefined {
  const kind = def.id.startsWith('inc-') ? 'income' : 'expense';
  return (
    categories.find((c) => !c.deleted && c.key === def.id) ??
    categories.find((c) => !c.deleted && c.kind === kind && c.name.trim().toLowerCase() === def.name.toLowerCase())
  );
}

export type CategoryChoice = {
  /** Workspace category id: what gets saved. */
  id: string;
  name: string;
  kind: 'income' | 'expense';
  subcategories: string[];
  taxonomyId?: string;
};

/** Pickable categories of one kind, in order, each with the subcategories switched on in Settings. */
export function useCategoryChoices(kind: 'income' | 'expense'): CategoryChoice[] {
  const { categories } = useDatabaseData();
  const { enabledExpenseIds, enabledIncomeIds, enabledSubcategories } = useCategoryPreferences();
  return useMemo(() => {
    const enabled = new Set(kind === 'income' ? enabledIncomeIds : enabledExpenseIds);
    return categories
      .filter((c) => c.kind === kind && !c.deleted && !c.hidden)
      .flatMap((c): CategoryChoice[] => {
        const def = taxonomyFor(c);
        if (def?.id === SAVE_OR_INVEST_TAXONOMY_ID) return [];
        // A taxonomy category switched off in Settings stays out of pickers; the person's own always show.
        if (def && c.key === def.id && !enabled.has(def.id)) return [];
        const subs = def ? (enabledSubcategories[def.id] ?? def.subcategories) : [];
        return [{ id: c.id, name: c.name, kind, subcategories: subs, taxonomyId: def?.id }];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, kind, enabledExpenseIds, enabledIncomeIds, enabledSubcategories]);
}

/**
 * Keeps the workspace in step with Settings › Categories: every taxonomy entry switched on has a real
 * category to point transactions at. Mount once inside the workspace.
 */
export function CategoryCatalogSync(): null {
  const { repo, isReady, categories } = useDatabaseData();
  const { enabledExpenseIds, enabledIncomeIds, isLoading } = useCategoryPreferences();
  const running = useRef(false);

  useEffect(() => {
    if (!isReady || isLoading || running.current) return;
    const wanted = [
      ...EXPENSE_TAXONOMY.filter((d) => enabledExpenseIds.includes(d.id) && d.id !== SAVE_OR_INVEST_TAXONOMY_ID),
      ...INCOME_TAXONOMY.filter((d) => enabledIncomeIds.includes(d.id)),
    ];
    const missing = wanted.filter((d) => !categoryForTaxonomy(categories, d));
    if (missing.length === 0) return;
    running.current = true;
    void (async () => {
      try {
        for (const def of missing) {
          await repo.ensureCatalogCategory({
            key: def.id,
            name: def.name,
            kind: def.id.startsWith('inc-') ? 'income' : 'expense',
          });
        }
      } catch (err) {
        console.warn('Could not create categories from Settings', err);
      } finally {
        running.current = false;
      }
    })();
  }, [repo, isReady, isLoading, categories, enabledExpenseIds, enabledIncomeIds]);

  return null;
}

const MISC_EXPENSE_ID = 'exp-miscellaneous';
const MISC_INCOME_ID = 'inc-miscellaneous';

/**
 * The workspace category id for a label from an older picker ("Food", "Food: Groceries" or an id).
 * Unknown names land in Miscellaneous, made if needed, never in whichever category happens to be first.
 */
export async function resolveCategoryId(
  repo: { ensureCatalogCategory: (input: { key: string; name: string; kind: 'income' | 'expense' }) => Promise<Category> },
  categories: Category[],
  label: string,
  kind: 'income' | 'expense',
): Promise<string> {
  const byId = categories.find((c) => c.id === label && !c.deleted);
  if (byId) return byId.id;
  const name = (label.split(':')[0] ?? '').trim().toLowerCase();
  const list = kind === 'income' ? INCOME_TAXONOMY : EXPENSE_TAXONOMY;
  const own = categories.find((c) => c.kind === kind && !c.deleted && c.name.trim().toLowerCase() === name);
  if (own) return own.id;
  const def =
    list.find((d) => d.name.toLowerCase() === name) ??
    list.find((d) => d.id === (kind === 'income' ? MISC_INCOME_ID : MISC_EXPENSE_ID))!;
  const existing = categoryForTaxonomy(categories, def);
  if (existing) return existing.id;
  return (await repo.ensureCatalogCategory({ key: def.id, name: def.name, kind })).id;
}
