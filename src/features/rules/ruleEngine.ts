import type { TransactionRule, RuleCondition, RuleAction, Payee } from '@/data/workspace/model';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';

export type RuleEventContext = {
  eventId: string;
  payeeName: string;
  description: string;
  amountMinor: bigint;
  accountId: string;
  categoryId: string;
  notes: string;
  date: string;
  type: string;
};

export function eventContext(snapshot: Snapshot, event: TxEvent): RuleEventContext | null {
  if (event.status !== 'posted' || event.type === 'transfer' || event.type === 'opening_balance' || event.type === 'reversal') return null;
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const moneyLine = event.lines.find((l) => accountIds.has(l.ledgerAccountId));
  if (!moneyLine) return null;
  const categoryLine = event.lines.find((l) => !accountIds.has(l.ledgerAccountId));
  const categoryId = categoryLine?.ledgerAccountId ?? '';
  const amountMinor = event.lines
    .filter((l) => !accountIds.has(l.ledgerAccountId))
    .reduce((s, l) => s + (l.amountMinor < 0n ? -l.amountMinor : l.amountMinor), 0n);
  const payee = event.payeeId ? snapshot.payees.find((p) => p.id === event.payeeId) : undefined;
  const payeeName = payee?.name ?? '';
  const aliasText = (payee?.aliases ?? []).join(' ');
  return {
    eventId: event.id,
    payeeName,
    description: aliasText || payeeName || event.notes || '',
    amountMinor,
    accountId: moneyLine.ledgerAccountId,
    categoryId,
    notes: event.notes ?? '',
    date: event.date,
    type: event.type,
  };
}

function parseAmount(value: string): bigint | null {
  const digits = value.replace(/[₦,\s]/g, '');
  if (!digits || !/^\d+(\.\d{0,2})?$/.test(digits)) return null;
  const [whole = '0', frac = ''] = digits.split('.');
  const minor = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
  return minor;
}

function fieldValue(ctx: RuleEventContext, field: RuleCondition['field']): string {
  switch (field) {
    case 'payee':
      return ctx.payeeName;
    case 'description':
      return ctx.description;
    case 'amount':
      return ctx.amountMinor.toString();
    case 'account':
      return ctx.accountId;
    case 'category':
      return ctx.categoryId;
    case 'notes':
      return ctx.notes;
    case 'date':
      return ctx.date;
    default:
      return '';
  }
}

export function conditionMatches(ctx: RuleEventContext, condition: RuleCondition): boolean {
  const raw = fieldValue(ctx, condition.field);
  const needle = condition.value.trim();
  if (!needle) return true;
  switch (condition.op) {
    case 'contains':
      return raw.toLowerCase().includes(needle.toLowerCase());
    case 'equals':
      if (condition.field === 'account' || condition.field === 'category') return raw === needle;
      return raw.toLowerCase() === needle.toLowerCase();
    case 'lessThan': {
      const limit = parseAmount(needle);
      return limit !== null && ctx.amountMinor < limit;
    }
    case 'greaterThan': {
      const limit = parseAmount(needle);
      return limit !== null && ctx.amountMinor > limit;
    }
    case 'before':
      return ctx.date < needle;
    case 'after':
      return ctx.date > needle;
    default:
      return false;
  }
}

export function ruleMatches(ctx: RuleEventContext, rule: TransactionRule): boolean {
  if (!rule.enabled || rule.conditions.length === 0) return false;
  const hits = rule.conditions.map((c) => conditionMatches(ctx, c));
  return rule.matchMode === 'any' ? hits.some(Boolean) : hits.every(Boolean);
}

export function orderedRules(rules: TransactionRule[]): TransactionRule[] {
  return [...rules].sort((a, b) => (a.stage === b.stage ? a.order - b.order : stageRank(a.stage) - stageRank(b.stage)));
}

function stageRank(stage: TransactionRule['stage']): number {
  return stage === 'first' ? 0 : stage === 'last' ? 2 : 1;
}

export function rulesForPayee(rules: TransactionRule[], payee: Payee): TransactionRule[] {
  const key = payee.name.toLowerCase();
  return rules.filter((rule) =>
    rule.conditions.some((c) => c.field === 'payee' && c.value.toLowerCase().includes(key) || key.includes(c.value.toLowerCase())),
  );
}

export function previewMatches(snapshot: Snapshot, rule: TransactionRule, fromDate?: string, toDate?: string): RuleEventContext[] {
  const out: RuleEventContext[] = [];
  for (const event of snapshot.events) {
    const ctx = eventContext(snapshot, event);
    if (!ctx) continue;
    if (fromDate && ctx.date < fromDate) continue;
    if (toDate && ctx.date > toDate) continue;
    if (ruleMatches(ctx, rule)) out.push(ctx);
  }
  return out;
}

export function previewRuleChange(
  snapshot: Snapshot,
  ctx: RuleEventContext,
  actions: RuleAction[],
): { categoryId?: string; payeeName?: string; notes?: string } {
  const change: { categoryId?: string; payeeName?: string; notes?: string } = {};
  for (const action of actions) {
    if (action.kind === 'setCategory') change.categoryId = action.value;
    if (action.kind === 'renamePayee') change.payeeName = action.value.trim();
    if (action.kind === 'addNote') {
      const note = action.value.trim();
      change.notes = change.notes ? `${change.notes}; ${note}` : note;
    }
  }
  return change;
}
