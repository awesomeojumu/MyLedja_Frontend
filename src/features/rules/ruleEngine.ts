import type { TransactionRule, RuleCondition, RuleAction, Payee } from '@/data/workspace/model';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { parseTags } from '@/features/transactions/tags';

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
  reconciled: boolean;
};

export type RulePreviewChange = {
  categoryId?: string;
  payeeName?: string;
  notes?: string;
  tags?: string[];
  scheduleId?: string;
  moneyBackDebtId?: string;
  split?: { mode: 'pct' | 'amt'; parts: { categoryId: string; value: number }[] };
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
    reconciled: !!event.reconciledBy,
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
    case 'money':
      return ctx.type === 'income' || ctx.amountMinor > 0n && ctx.type !== 'expense' ? 'in' : 'out';
    default:
      return '';
  }
}

export function conditionMatches(ctx: RuleEventContext, condition: RuleCondition): boolean {
  const raw = fieldValue(ctx, condition.field);
  const needle = condition.value.trim();
  if (condition.op === 'isEmpty') {
    return condition.field === 'category' ? !ctx.categoryId : !raw.trim();
  }
  if (condition.op === 'isIn') {
    return condition.field === 'money' ? fieldValue(ctx, 'money') === 'in' : false;
  }
  if (condition.op === 'isOut') {
    return condition.field === 'money' ? fieldValue(ctx, 'money') === 'out' : false;
  }
  if (!needle) return true;
  switch (condition.op) {
    case 'contains':
      return raw.toLowerCase().includes(needle.toLowerCase());
    case 'startsWith':
      return raw.toLowerCase().startsWith(needle.toLowerCase());
    case 'equals':
      if (condition.field === 'account' || condition.field === 'category') return raw === needle;
      return raw.toLowerCase() === needle.toLowerCase();
    case 'notEquals':
      if (condition.field === 'account' || condition.field === 'category') return raw !== needle;
      return raw.toLowerCase() !== needle.toLowerCase();
    case 'isOneOf':
      return needle
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .includes(raw.toLowerCase());
    case 'lessThan': {
      const limit = parseAmount(needle);
      return limit !== null && ctx.amountMinor < limit;
    }
    case 'greaterThan': {
      const limit = parseAmount(needle);
      return limit !== null && ctx.amountMinor > limit;
    }
    case 'between': {
      const parts = needle.split(/[|,]/).map((s) => parseAmount(s.trim()));
      const a = parts[0];
      const b = parts[1];
      return a != null && b != null && ctx.amountMinor >= a && ctx.amountMinor <= b;
    }
    case 'before':
      return ctx.date < needle;
    case 'after':
      return ctx.date > needle;
    case 'dayOfMonth':
      return ctx.date.slice(8, 10) === needle.padStart(2, '0');
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
    rule.conditions.some((c) => c.field === 'payee' && (c.value.toLowerCase().includes(key) || key.includes(c.value.toLowerCase()))),
  );
}

/** Split encoding: `pct:catA=60|catB=40` or `amt:catA=1000|catB=500` (naira major units). */
export function parseSplitValue(value: string): RulePreviewChange['split'] | null {
  const raw = value.trim();
  const m = /^(pct|amt):(.+)$/i.exec(raw);
  if (!m) return null;
  const mode = m[1]!.toLowerCase() as 'pct' | 'amt';
  const parts = m[2]!
    .split('|')
    .map((chunk) => {
      const [categoryId, v] = chunk.split('=');
      const num = Number(v);
      if (!categoryId?.trim() || !Number.isFinite(num) || num <= 0) return null;
      return { categoryId: categoryId.trim(), value: num };
    })
    .filter(Boolean) as { categoryId: string; value: number }[];
  if (parts.length < 2) return null;
  return { mode, parts };
}

export function encodeSplitValue(mode: 'pct' | 'amt', parts: { categoryId: string; value: number }[]): string {
  return `${mode}:${parts.map((p) => `${p.categoryId}=${p.value}`).join('|')}`;
}

/** PU48-2: percent parts must total 100; amount parts must total the txn amount (naira). */
export function splitTotalsOk(split: NonNullable<RulePreviewChange['split']>, amountMinor: bigint): boolean {
  const sum = split.parts.reduce((s, p) => s + p.value, 0);
  if (split.mode === 'pct') return Math.abs(sum - 100) < 0.01;
  const naira = Number(amountMinor) / 100;
  return Math.abs(sum - naira) < 0.01;
}

export function previewRuleChange(ctx: RuleEventContext, actions: RuleAction[]): RulePreviewChange {
  const change: RulePreviewChange = {};
  for (const action of actions) {
    if (action.kind === 'setCategory' && action.value) change.categoryId = action.value;
    if (action.kind === 'renamePayee' && action.value.trim()) change.payeeName = action.value.trim();
    if (action.kind === 'addNote' && action.value.trim()) {
      const note = action.value.trim();
      change.notes = change.notes ? `${change.notes}; ${note}` : note;
    }
    if (action.kind === 'addTag' && action.value.trim()) {
      const tags = action.value.split(',').map((t) => t.trim()).filter(Boolean);
      change.tags = [...(change.tags ?? []), ...tags];
    }
    if (action.kind === 'split') {
      const split = parseSplitValue(action.value);
      if (split) change.split = split;
    }
    if (action.kind === 'linkSchedule' && action.value.trim()) change.scheduleId = action.value.trim();
    if (action.kind === 'moneyBack' && action.value.trim()) change.moneyBackDebtId = action.value.trim();
  }
  return change;
}

/** Whether applying the rule would alter this match (PU49-1 / P25-03). */
export function matchWouldChange(ctx: RuleEventContext, actions: RuleAction[]): boolean {
  if (ctx.reconciled) return false;
  if (actions.length === 0) return false;
  const change = previewRuleChange(ctx, actions);
  if (change.categoryId && change.categoryId !== ctx.categoryId) return true;
  if (change.payeeName && change.payeeName.toLowerCase() !== ctx.payeeName.toLowerCase()) return true;
  if (change.notes) return true;
  if (change.tags?.length) {
    const existing = new Set(parseTags(ctx.notes).map((t) => t.toLowerCase()));
    if (change.tags.some((t) => !existing.has(t.toLowerCase()))) return true;
  }
  if (change.split && splitTotalsOk(change.split, ctx.amountMinor)) return true;
  if (change.scheduleId) return true;
  if (change.moneyBackDebtId) return true;
  return false;
}

export function previewMatches(
  snapshot: Snapshot,
  rule: TransactionRule,
  fromDate?: string,
  toDate?: string,
  opts?: { onlyChanging?: boolean },
): RuleEventContext[] {
  const out: RuleEventContext[] = [];
  let skippedReconciled = 0;
  for (const event of snapshot.events) {
    const ctx = eventContext(snapshot, event);
    if (!ctx) continue;
    if (fromDate && ctx.date < fromDate) continue;
    if (toDate && ctx.date > toDate) continue;
    if (!ruleMatches(ctx, rule)) continue;
    if (ctx.reconciled) {
      skippedReconciled += 1;
      continue;
    }
    if (opts?.onlyChanging && !matchWouldChange(ctx, rule.actions)) continue;
    out.push(ctx);
  }
  (out as RuleEventContext[] & { skippedReconciled?: number }).skippedReconciled = skippedReconciled;
  return out;
}

export function countReconciledSkipped(
  snapshot: Snapshot,
  rule: TransactionRule,
  fromDate?: string,
  toDate?: string,
): number {
  let n = 0;
  for (const event of snapshot.events) {
    const ctx = eventContext(snapshot, event);
    if (!ctx) continue;
    if (fromDate && ctx.date < fromDate) continue;
    if (toDate && ctx.date > toDate) continue;
    if (!ruleMatches(ctx, rule)) continue;
    if (ctx.reconciled) n += 1;
  }
  return n;
}

/**
 * What the person's rules change on a new or imported transaction (P25-05), in run order: first, normal, last.
 * Later rules override earlier ones; notes add up. The server applies the same rules to imports and bank sync.
 */
export function ruleChangeFor(
  rules: TransactionRule[],
  input: Omit<RuleEventContext, 'eventId' | 'type' | 'reconciled'> & { type?: string },
): { categoryId?: string; payeeName?: string; notes?: string; tags?: string[] } {
  const ctx: RuleEventContext = { ...input, eventId: '', type: input.type ?? '', reconciled: false };
  const change: { categoryId?: string; payeeName?: string; notes?: string; tags?: string[] } = {};
  for (const rule of orderedRules(rules)) {
    if ((rule as TransactionRule & { deleted?: boolean }).deleted || !ruleMatches(ctx, rule)) continue;
    for (const a of rule.actions) {
      if (a.kind === 'setCategory' && a.value) change.categoryId = a.value;
      if (a.kind === 'renamePayee' && a.value.trim()) change.payeeName = a.value.trim();
      if (a.kind === 'addNote' && a.value.trim()) change.notes = [change.notes, a.value.trim()].filter(Boolean).join('. ');
      if (a.kind === 'addTag' && a.value.trim()) {
        const tags = a.value.split(',').map((t) => t.trim()).filter(Boolean);
        change.tags = [...(change.tags ?? []), ...tags];
      }
    }
  }
  return change;
}
