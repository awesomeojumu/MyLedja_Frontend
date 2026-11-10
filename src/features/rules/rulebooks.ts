import type { Category, RuleAction, RuleCondition, TransactionRule } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { encodeSplitValue } from './ruleEngine';

export type RulebookSplit = {
  bucketKey: string;
  pct: number;
  categoryKeywords: string[];
};

export type RulebookTemplate = {
  id: 'nigerian_balanced' | '50_30_20' | '70_20_10';
  nameKey: string;
  descKey: string;
  splits: RulebookSplit[];
};

export const RULEBOOK_TEMPLATES: RulebookTemplate[] = [
  {
    id: 'nigerian_balanced',
    nameKey: 'rules.rulebook.nigerianName',
    descKey: 'rules.rulebook.nigerianDesc',
    splits: [
      {
        bucketKey: 'living',
        pct: 60,
        categoryKeywords: ['food', 'market', 'groceries', 'utilities', 'bills', 'housing', 'transport'],
      },
      {
        bucketKey: 'investment',
        pct: 20,
        categoryKeywords: ['investment', 'savings', 'emergency', 'growth', 'wealth'],
      },
      {
        bucketKey: 'family',
        pct: 10,
        categoryKeywords: ['family', 'black tax', 'parents', 'support', 'giving', 'household'],
      },
      {
        bucketKey: 'faith',
        pct: 10,
        categoryKeywords: ['tithe', 'church', 'mosque', 'faith', 'offering', 'charity', 'donation'],
      },
    ],
  },
  {
    id: '50_30_20',
    nameKey: 'rules.rulebook.rule503020Name',
    descKey: 'rules.rulebook.rule503020Desc',
    splits: [
      {
        bucketKey: 'needs',
        pct: 50,
        categoryKeywords: ['food', 'market', 'utilities', 'bills', 'housing', 'rent', 'transport'],
      },
      {
        bucketKey: 'wants',
        pct: 30,
        categoryKeywords: ['dining', 'entertainment', 'shopping', 'personal', 'leisure', 'fun'],
      },
      {
        bucketKey: 'savings',
        pct: 20,
        categoryKeywords: ['savings', 'debt', 'emergency', 'investment', 'future'],
      },
    ],
  },
  {
    id: '70_20_10',
    nameKey: 'rules.rulebook.rule702010Name',
    descKey: 'rules.rulebook.rule702010Desc',
    splits: [
      {
        bucketKey: 'living',
        pct: 70,
        categoryKeywords: ['food', 'market', 'bills', 'housing', 'transport', 'living'],
      },
      {
        bucketKey: 'savings',
        pct: 20,
        categoryKeywords: ['savings', 'investment', 'emergency', 'goals'],
      },
      {
        bucketKey: 'giving',
        pct: 10,
        categoryKeywords: ['giving', 'charity', 'tithe', 'family', 'gifts'],
      },
    ],
  },
];

/**
 * Resolves each bucket of a rulebook to a category in the user's workspace.
 */
export function resolveBucketCategories(
  splits: RulebookSplit[],
  categories: Category[],
): { bucketKey: string; pct: number; categoryId: string; categoryName: string }[] {
  const expenseCategories = categories.filter((c) => c.kind === 'expense' && !c.hidden);
  const fallback = expenseCategories[0]?.id ?? '';

  return splits.map((split) => {
    let matched: Category | undefined;
    for (const keyword of split.categoryKeywords) {
      matched = expenseCategories.find(
        (c) =>
          c.name.toLowerCase().includes(keyword) ||
          (c.key && c.key.toLowerCase().includes(keyword)) ||
          (c.group && c.group.toLowerCase().includes(keyword)),
      );
      if (matched) break;
    }
    const chosen = matched ?? expenseCategories[0];
    return {
      bucketKey: split.bucketKey,
      pct: split.pct,
      categoryId: chosen?.id ?? fallback,
      categoryName: chosen?.name ?? 'General',
    };
  });
}

/**
 * Constructs an actionable inflow earmarking rule from a chosen rulebook template.
 */
export function buildRulebookRule(
  template: RulebookTemplate,
  snapshot: Snapshot,
  options?: { incomePayeeName?: string; customMappings?: Record<string, string> },
): Omit<TransactionRule, 'id' | 'matchedCount'> {
  const resolved = resolveBucketCategories(template.splits, snapshot.categories);

  const parts = resolved.map((r) => ({
    categoryId: options?.customMappings?.[r.bucketKey] ?? r.categoryId,
    value: r.pct,
  }));

  const splitValue = encodeSplitValue('pct', parts);

  const conditions: RuleCondition[] = options?.incomePayeeName?.trim()
    ? [{ field: 'payee', op: 'contains', value: options.incomePayeeName.trim() }]
    : [{ field: 'money', op: 'isIn', value: 'in' }];

  const actions: RuleAction[] = [{ kind: 'split', value: splitValue }];

  return {
    enabled: true,
    stage: 'first',
    order: 0,
    matchMode: 'all',
    conditions,
    actions,
  };
}
