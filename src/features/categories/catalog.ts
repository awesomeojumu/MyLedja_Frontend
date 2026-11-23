import { useEffect, useMemo, useRef } from 'react';

import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, type CategoryDefinition } from '../../data/categoriesTaxonomy';
import type { Category } from '../../data/workspace/model';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { useCategoryPreferences } from './CategoryPreferencesContext';

/**
 * One way in for category pickers.
 *
 * The workspace's categories (synced, with ids) are the source of truth: every transaction, budget line and
 * rule points at one of them by id. The taxonomy supplies the starter set:
 *
 * - each spending category (Housing, Food…) is a category group, holding a general line keyed by the taxonomy
 *   id (`exp-housing`) and one category per subcategory switched on in Settings (`exp-housing:rent`);
 * - each income source (Employment, Business…) is one category in the Income group.
 *
 * Settings › Categories says which taxonomy entries and subcategories are switched on.
 */

/** Saving and investing are moves between your own accounts, not spending; they get their own flow. */
export const SAVE_OR_INVEST_TAXONOMY_ID = 'exp-savings-investments';
/** Loan and debt repayments reduce what you owe; they get their own flow too. */
export const DEBT_TAXONOMY_ID = 'exp-financial';

const ALL_TAXONOMY = [...EXPENSE_TAXONOMY, ...INCOME_TAXONOMY];
const MISC_EXPENSE_ID = 'exp-miscellaneous';
const MISC_INCOME_ID = 'inc-miscellaneous';

export const kindOfDef = (def: CategoryDefinition): 'income' | 'expense' => (def.id.startsWith('inc-') ? 'income' : 'expense');

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** The catalogue key of a subcategory: `exp-housing:rent`. */
export const subKey = (def: CategoryDefinition, sub: string) => `${def.id}:${slug(sub)}`;

/** Splits a catalogue key into its taxonomy entry and, for subcategories, the subcategory name. */
export function parseKey(key: string | undefined): { def?: CategoryDefinition; sub?: string } {
  if (!key) return {};
  const [defId, subSlug] = key.split(':');
  const def = ALL_TAXONOMY.find((d) => d.id === defId);
  if (!def || !subSlug) return { def };
  return { def, sub: def.subcategories.find((s) => slug(s) === subSlug) };
}

/** The taxonomy entry a category belongs to, by key (general line or subcategory) or by name. */
export function taxonomyFor(category: Pick<Category, 'key' | 'name' | 'kind'>): CategoryDefinition | undefined {
  const { def } = parseKey(category.key);
  if (def) return def;
  const list = category.kind === 'income' ? INCOME_TAXONOMY : EXPENSE_TAXONOMY;
  const lower = category.name.trim().toLowerCase();
  return list.find((d) => d.name.toLowerCase() === lower);
}

/** The workspace category for a catalogue key, falling back to the name for categories made before keys. */
export function categoryByKey(categories: Category[], key: string, name: string, kind: 'income' | 'expense'): Category | undefined {
  const lower = name.trim().toLowerCase();
  return (
    categories.find((c) => !c.deleted && c.key === key) ??
    (key.includes(':') ? undefined : categories.find((c) => !c.deleted && c.kind === kind && !c.key && c.name.trim().toLowerCase() === lower))
  );
}

/** The general line that stands for a taxonomy entry, if it exists yet. */
export function categoryForTaxonomy(categories: Category[], def: CategoryDefinition): Category | undefined {
  return categoryByKey(categories, def.id, def.name, kindOfDef(def));
}

/** One category the catalogue wants in the workspace. */
export type CatalogEntry = {
  key: string;
  name: string;
  /** The category group's name: the taxonomy category for spending, "Income" for income. */
  group: string;
  kind: 'income' | 'expense';
  def: CategoryDefinition;
  sub?: string;
};

/**
 * Everything switched on, as workspace categories: spending categories with their subcategories, then income.
 * A subcategory whose name appears more than once (Electricity, Repairs, Gifts…) gets its category in brackets,
 * so every name is unique.
 */
export function catalogEntries(
  expenseIds: string[],
  incomeIds: string[],
  enabledSubcategories: Record<string, string[]>,
): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const def of EXPENSE_TAXONOMY) {
    if (!expenseIds.includes(def.id) || def.id === SAVE_OR_INVEST_TAXONOMY_ID) continue;
    out.push({ key: def.id, name: def.name, group: def.name, kind: 'expense', def });
    for (const sub of enabledSubcategories[def.id] ?? def.subcategories) {
      if (!def.subcategories.includes(sub)) continue;
      out.push({ key: subKey(def, sub), name: sub, group: def.name, kind: 'expense', def, sub });
    }
  }
  const count = new Map<string, number>();
  for (const e of out) count.set(e.name.toLowerCase(), (count.get(e.name.toLowerCase()) ?? 0) + 1);
  for (const e of out) {
    if (e.sub && (count.get(e.name.toLowerCase()) ?? 0) > 1) e.name = `${e.sub} (${e.def.name})`;
  }
  for (const def of INCOME_TAXONOMY) {
    if (incomeIds.includes(def.id)) out.push({ key: def.id, name: def.name, group: 'Income', kind: 'income', def });
  }
  return out;
}

export type CategoryNode = { id: string; name: string };

/** A pickable category: the general line, with its subcategories under it. */
export type CategoryGroupChoice = {
  /** Stable key for pickers: the taxonomy id, or `own:<id>` for the person's own categories. */
  key: string;
  name: string;
  /** Where a transaction goes when no subcategory is picked. */
  generalId: string;
  children: CategoryNode[];
  taxonomyId?: string;
};

/** Pickable categories of one kind, each with the subcategories switched on in Settings. */
export function useCategoryTree(kind: 'income' | 'expense'): CategoryGroupChoice[] {
  const { categories } = useDatabaseData();
  const { enabledExpenseIds, enabledIncomeIds, enabledSubcategories } = useCategoryPreferences();
  return useMemo(() => {
    const enabled = new Set(kind === 'income' ? enabledIncomeIds : enabledExpenseIds);
    const live = categories.filter((c) => c.kind === kind && !c.deleted && !c.hidden);
    const groups = new Map<string, CategoryGroupChoice>();
    const subsOf = new Map<string, CategoryNode[]>();
    for (const c of live) {
      const { def, sub } = parseKey(c.key);
      const owner = def ?? taxonomyFor(c);
      if (owner?.id === SAVE_OR_INVEST_TAXONOMY_ID) continue;
      if (owner && sub) {
        // Subcategories switched off in Settings stay out of pickers.
        const on = enabledSubcategories[owner.id] ?? owner.subcategories;
        if (!enabled.has(owner.id) || !on.includes(sub)) continue;
        subsOf.set(owner.id, [...(subsOf.get(owner.id) ?? []), { id: c.id, name: sub }]);
        continue;
      }
      if (owner && (c.key === owner.id || !c.key)) {
        if (!enabled.has(owner.id)) continue;
        if (!groups.has(owner.id)) groups.set(owner.id, { key: owner.id, name: c.name, generalId: c.id, children: [], taxonomyId: owner.id });
        continue;
      }
      groups.set(`own:${c.id}`, { key: `own:${c.id}`, name: c.name, generalId: c.id, children: [] });
    }
    for (const [defId, children] of subsOf) {
      const group = groups.get(defId);
      if (group) group.children = children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, kind, enabledExpenseIds, enabledIncomeIds, enabledSubcategories]);
}

/** Flat list of every pickable category, labelled "Food · Groceries". */
export function useCategoryChoices(kind: 'income' | 'expense'): CategoryNode[] {
  const tree = useCategoryTree(kind);
  return useMemo(
    () =>
      tree.flatMap((g) => [
        { id: g.generalId, name: g.name },
        ...g.children.map((c) => ({ id: c.id, name: `${g.name} · ${c.name}` })),
      ]),
    [tree],
  );
}

type EnsureRepo = {
  ensureCatalogCategory: (input: { key: string; name: string; kind: 'income' | 'expense'; group?: string }) => Promise<Category>;
};

/**
 * Keeps the workspace in step with Settings › Categories: every category and subcategory switched on has a
 * real category to point transactions at. Mount once inside the workspace.
 */
export function CategoryCatalogSync(): null {
  const { repo, isReady, categories } = useDatabaseData();
  const { enabledExpenseIds, enabledIncomeIds, enabledSubcategories, isLoading } = useCategoryPreferences();
  const running = useRef(false);

  useEffect(() => {
    if (!isReady || isLoading || running.current) return;
    const missing = catalogEntries(enabledExpenseIds, enabledIncomeIds, enabledSubcategories).filter(
      (e) => !categoryByKey(categories, e.key, e.name, e.kind),
    );
    if (missing.length === 0) return;
    running.current = true;
    void (async () => {
      try {
        for (const e of missing) await repo.ensureCatalogCategory({ key: e.key, name: e.name, kind: e.kind, group: e.group });
      } catch (err) {
        console.warn('Could not create categories from Settings', err);
      } finally {
        running.current = false;
      }
    })();
  }, [repo, isReady, isLoading, categories, enabledExpenseIds, enabledIncomeIds, enabledSubcategories]);

  return null;
}

/**
 * The workspace category id for a label from an older picker ("Food", "Food: Groceries" or an id).
 * Unknown names land in Miscellaneous, made if needed, never in whichever category happens to be first.
 */
export async function resolveCategoryId(
  repo: EnsureRepo,
  categories: Category[],
  label: string,
  kind: 'income' | 'expense',
): Promise<string> {
  const byId = categories.find((c) => c.id === label && !c.deleted);
  if (byId) return byId.id;
  const [rawName = '', rawSub = ''] = label.split(':');
  const name = rawName.trim().toLowerCase();
  const subName = rawSub.trim().toLowerCase();
  const list = kind === 'income' ? INCOME_TAXONOMY : EXPENSE_TAXONOMY;
  const def = list.find((d) => d.name.toLowerCase() === name);
  if (def && subName) {
    const sub = def.subcategories.find((s) => s.toLowerCase() === subName);
    if (sub) {
      const key = subKey(def, sub);
      const found = categories.find((c) => !c.deleted && c.key === key);
      if (found) return found.id;
      return (await repo.ensureCatalogCategory({ key, name: sub, kind, group: def.name })).id;
    }
  }
  if (!def) {
    const own = categories.find((c) => c.kind === kind && !c.deleted && c.name.trim().toLowerCase() === name);
    if (own) return own.id;
  }
  const target = def ?? list.find((d) => d.id === (kind === 'income' ? MISC_INCOME_ID : MISC_EXPENSE_ID))!;
  const existing = categoryForTaxonomy(categories, target);
  if (existing) return existing.id;
  return (
    await repo.ensureCatalogCategory({ key: target.id, name: target.name, kind, group: kind === 'income' ? 'Income' : target.name })
  ).id;
}
