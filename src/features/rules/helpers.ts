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
  return t('rules.action.addNote', { note: a.value });
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


export function payeeMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
