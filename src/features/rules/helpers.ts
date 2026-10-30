import { t, type TextKey } from '@/i18n';
import type { TransactionRule, RuleCondition, RuleAction } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

export function ruleSentence(rule: TransactionRule, snapshot: Snapshot): { when: string; then: string } {
  const whenParts = rule.conditions.map((c) => conditionLabel(c, snapshot));
  const when =
    rule.conditions.length === 0
      ? t('rules.whenEmpty')
      : t('rules.whenLine', { parts: whenParts.join(rule.matchMode === 'any' ? t('rules.orJoin') : t('rules.andJoin')) });
  const actionParts = rule.actions.map((a) => actionLabel(a, snapshot));
  const then = actionParts.length ? actionParts.join(t('rules.actionJoin')) : t('rules.thenEmpty');
  return { when, then };
}

function conditionLabel(c: RuleCondition, snapshot: Snapshot): string {
  const field = t(`rules.field.${c.field}` as TextKey);
  const op = t(`rules.op.${c.op}` as TextKey);
  let value = c.value;
  if (c.field === 'category') value = snapshot.categories.find((x) => x.id === c.value)?.name ?? c.value;
  if (c.field === 'account') value = snapshot.accounts.find((x) => x.id === c.value)?.name ?? c.value;
  return `${field} ${op} "${value}"`;
}

function actionLabel(a: RuleAction, snapshot: Snapshot): string {
  if (a.kind === 'setCategory') {
    const name = snapshot.categories.find((c) => c.id === a.value)?.name ?? a.value;
    return t('rules.action.setCategory', { name });
  }
  if (a.kind === 'renamePayee') return t('rules.action.renamePayee', { name: a.value });
  if (a.kind === 'addNote') return t('rules.action.addNote', { note: a.value });
  if (a.kind === 'addTag') return t('rules.actionKind.addTag') + ` ${a.value}`;
  if (a.kind === 'split') return t('rules.actionKind.split');
  if (a.kind === 'linkSchedule') {
    const name = snapshot.recurring.find((r) => r.id === a.value)?.name ?? a.value;
    return `${t('rules.actionKind.linkSchedule')} ${name}`;
  }
  if (a.kind === 'moneyBack') {
    const name = snapshot.debts.find((d) => d.id === a.value)?.name ?? a.value;
    return `${t('rules.actionKind.moneyBack')} ${name}`;
  }
  return a.value;
}

export const RULE_STAGES: TransactionRule['stage'][] = ['first', 'normal', 'last'];

export function showRuleStages(ruleCount: number): boolean {
  return ruleCount > 10;
}

export function stageTitle(stage: TransactionRule['stage']): string {
  return t(`rules.stage.${stage}` as TextKey);
}

export function newBlankRule(order: number): Omit<TransactionRule, 'id' | 'matchedCount'> {
  return {
    enabled: true,
    stage: 'normal',
    order,
    matchMode: 'all',
    conditions: [{ field: 'payee', op: 'contains', value: '' }],
    actions: [{ kind: 'setCategory', value: '' }],
  };
}

export function ruleFromPayee(payeeName: string, categoryId?: string): Omit<TransactionRule, 'id' | 'matchedCount' | 'order'> {
  return {
    enabled: true,
    stage: 'normal',
    matchMode: 'all',
    conditions: [{ field: 'payee', op: 'contains', value: payeeName }],
    actions: categoryId ? [{ kind: 'setCategory', value: categoryId }] : [{ kind: 'setCategory', value: '' }],
  };
}

/** PU-18 → PU-48: seed a rule from a posted transaction. */
export function ruleFromTransaction(input: {
  payeeName?: string;
  description?: string;
  categoryId?: string;
}): Omit<TransactionRule, 'id' | 'matchedCount' | 'order'> {
  const conditions: TransactionRule['conditions'] = [];
  if (input.payeeName?.trim()) conditions.push({ field: 'payee', op: 'contains', value: input.payeeName.trim() });
  else if (input.description?.trim()) conditions.push({ field: 'description', op: 'contains', value: input.description.trim() });
  else conditions.push({ field: 'payee', op: 'contains', value: '' });
  return {
    enabled: true,
    stage: 'normal',
    matchMode: 'all',
    conditions,
    actions: input.categoryId ? [{ kind: 'setCategory', value: input.categoryId }] : [{ kind: 'setCategory', value: '' }],
  };
}

/** PU-58 → PU-48: always treat matching money as money-back from this person/debt. */
export function ruleFromMoneyBack(input: {
  payeeName: string;
  debtId: string;
}): Omit<TransactionRule, 'id' | 'matchedCount' | 'order'> {
  return {
    enabled: true,
    stage: 'normal',
    matchMode: 'all',
    conditions: [{ field: 'payee', op: 'contains', value: input.payeeName }],
    actions: [{ kind: 'moneyBack', value: input.debtId }],
  };
}


export function payeeMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** Figma Phone / Rules list title: "If payee contains Shoprite". */
export function ruleIfTitle(rule: TransactionRule, snapshot: Snapshot): string {
  if (rule.conditions.length === 0) return t('rules.redesign.ifAnything');
  const parts = rule.conditions.map((c) => {
    const field = t(`rules.field.${c.field}` as TextKey).toLowerCase();
    const op = t(`rules.op.${c.op}` as TextKey);
    let value = c.value;
    if (c.field === 'category') value = snapshot.categories.find((x) => x.id === c.value)?.name ?? c.value;
    if (c.field === 'account') value = snapshot.accounts.find((x) => x.id === c.value)?.name ?? c.value;
    if (c.op === 'isEmpty' || c.op === 'isIn' || c.op === 'isOut') return `${field} ${op}`;
    return `${field} ${op} ${value}`;
  });
  const join = rule.matchMode === 'any' ? ` ${t('rules.redesign.or')} ` : ` ${t('rules.redesign.and')} `;
  return t('rules.redesign.ifLine', { parts: parts.join(join) });
}

/** Figma list subtitle: "Set category to Groceries". */
export function ruleThenTitle(rule: TransactionRule, snapshot: Snapshot): string {
  if (rule.actions.length === 0) return t('rules.thenEmpty');
  return rule.actions
    .map((a) => {
      if (a.kind === 'setCategory') {
        const name = snapshot.categories.find((c) => c.id === a.value)?.name ?? a.value;
        return t('rules.redesign.setCategory', { name });
      }
      if (a.kind === 'renamePayee') return t('rules.redesign.renamePayee', { name: a.value });
      if (a.kind === 'addNote') return t('rules.redesign.addNote', { note: a.value });
      return actionLabel(a, snapshot);
    })
    .join(t('rules.actionJoin'));
}

export type SuggestedRule = {
  key: string;
  payeeName: string;
  categoryId: string;
  categoryName: string;
  matchCount: number;
};

/**
 * Heuristic suggestions (Figma Phone / Rules / Suggested): payees with ≥2 txs
 * sharing one category and no existing payee-contains rule for that name.
 */
export function suggestRules(snapshot: Snapshot): SuggestedRule[] {
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const byPayee = new Map<string, Map<string, number>>();
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'expense' || !e.payeeId) continue;
    const cat = e.lines.find((l) => !accountIds.has(l.ledgerAccountId))?.ledgerAccountId;
    if (!cat) continue;
    const cats = byPayee.get(e.payeeId) ?? new Map<string, number>();
    cats.set(cat, (cats.get(cat) ?? 0) + 1);
    byPayee.set(e.payeeId, cats);
  }
  const out: SuggestedRule[] = [];
  for (const [payeeId, cats] of byPayee) {
    const payee = snapshot.payees.find((p) => p.id === payeeId);
    if (!payee) continue;
    let bestId = '';
    let bestCount = 0;
    for (const [catId, n] of cats) {
      if (n > bestCount) {
        bestId = catId;
        bestCount = n;
      }
    }
    if (bestCount < 2 || !bestId) continue;
    const covered = snapshot.rules.some(
      (r) =>
        r.conditions.some((c) => c.field === 'payee' && c.op === 'contains' && c.value.toLowerCase() === payee.name.toLowerCase()) &&
        r.actions.some((a) => a.kind === 'setCategory' && a.value === bestId),
    );
    if (covered) continue;
    const categoryName = snapshot.categories.find((c) => c.id === bestId)?.name ?? '';
    out.push({
      key: `${payeeId}:${bestId}`,
      payeeName: payee.name,
      categoryId: bestId,
      categoryName,
      matchCount: bestCount,
    });
  }
  return out.sort((a, b) => b.matchCount - a.matchCount).slice(0, 8);
}
