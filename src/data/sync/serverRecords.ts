import type {
  AccountKind,
  Goal,
  IncomeStream,
  IncomeStreamKind,
  PersonDebt,
  RecurrenceRule,
  Recurring,
  RecurringOccurrence,
  StoredEvent,
} from '@/data/workspace/model';

import type { LocalRecord } from './types';

/**
 * Translates the API's records into the app's local records, and the app's Phase 2 records into API bodies.
 * The server is the source of truth (TECH-SPEC 9.6), so what it sends replaces what the device holds.
 */

type Doc = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** Server recurrence { every, unit, dayOfMonth, weekday } → the app's { every, on, interval }. */
export function recurrenceFromServer(r: Doc | undefined, startDate: string): RecurrenceRule {
  const unit = (str(r?.unit) ?? 'month') as RecurrenceRule['every'];
  const every = num(r?.every) ?? 1;
  if (unit === 'day') return { every: 'day', on: every };
  if (unit === 'week') return { every: 'week', on: num(r?.weekday) ?? 1, interval: every };
  const on = num(r?.dayOfMonth) ?? Number(startDate.slice(8, 10));
  if (unit === 'year') return { every: 'year', on, interval: every, monthOfYear: Number(startDate.slice(5, 7)) };
  return { every: 'month', on, interval: every };
}

export function recurrenceToServer(rule: RecurrenceRule) {
  if (rule.every === 'day') return { every: Math.max(1, rule.on), unit: 'day', dayOfMonth: null, weekday: null };
  if (rule.every === 'week') return { every: rule.interval ?? 1, unit: 'week', dayOfMonth: null, weekday: rule.on };
  return { every: rule.interval ?? 1, unit: rule.every, dayOfMonth: rule.on, weekday: null };
}

const SERVER_ACCOUNT_TYPE: Record<string, AccountKind> = {
  bank: 'bank',
  cash: 'cash',
  wallet: 'wallet',
  savings: 'savings',
  fixed_deposit: 'fixed_deposit',
  card: 'card',
  loan: 'loan',
  investment: 'investment',
  property: 'property',
  pension: 'pension',
  other_asset: 'other_asset',
  other_liability: 'other_liability',
  /** Legacy FE coarse type from before BE parity. */
  other: 'other_asset',
};

const STREAM_KIND_FROM: Record<string, IncomeStreamKind> = { regular: 'regular', varies: 'variable', irregular: 'irregular', passive: 'passive' };
const STREAM_KIND_TO: Record<IncomeStreamKind, string> = { regular: 'regular', variable: 'varies', irregular: 'irregular', passive: 'passive' };

const minorOrUndefined = (v: unknown) => (typeof v === 'string' ? v : undefined);

function eventFromServer(doc: Doc, workspaceId: string): StoredEvent & { operationId: string } {
  const lines = (doc.lines as Doc[] | undefined) ?? [];
  const links = (doc.links as Doc | undefined) ?? {};
  return {
    operationId: String(doc.id),
    type: doc.type as StoredEvent['type'],
    date: String(doc.date),
    lines: lines.map((l) => ({
      // The app's chart names real accounts and categories by their own ids, and system accounts by workspace and key.
      a: str(l.accountId) ?? (str(l.system) ? `${workspaceId}:${String(l.system)}` : (str(l.categoryId) ?? String(l.ledgerAccountId))),
      m: String(l.amount),
      c: String(l.currency ?? 'NGN'),
    })),
    reversalOf: str(links.reversalOf),
    refundOf: str(links.refundOf),
    payeeId: str(doc.payeeId),
    notes: str(doc.notes),
    correctionOf: str(links.correctionOf),
    cleared: Array.isArray(doc.clearedAccountIds) && doc.clearedAccountIds.length > 0 ? true : undefined,
    // Locked by a finished reconcile (🔒). Prefer the server id; `reconciled: true` alone still locks.
    reconciledBy: str(doc.reconciliationId) ?? (doc.reconciled === true ? 'reconciled' : undefined),
    importId: str(doc.importId),
    goalId: str(links.goalId),
    debtId: str(links.debtId),
    recurringId: str(links.scheduleId),
  };
}

/** One server change → the local record it stands for, or null when the app keeps no copy of it. */
export function localFromServer(collection: string, id: string, doc: unknown, workspaceId: string): LocalRecord | null {
  if (!doc || typeof doc !== 'object') return null;
  const d = doc as Doc;
  const version = num(d.version) ?? 1;
  const rec = (c: string, recId: string, data: object): LocalRecord => ({ id: recId, collection: c, version, data: data as Record<string, unknown> });
  switch (collection) {
    case 'transactions':
      return rec('events', id, eventFromServer(d, workspaceId));
    case 'accounts':
      return rec('accounts', id, {
        name: d.name,
        type: SERVER_ACCOUNT_TYPE[String(d.type)] ?? 'other_asset',
        currency: d.currency ?? 'NGN',
        institution: str(d.institution),
        last4: str(d.last4),
        countInBudget: d.onBudget !== false,
        archived: d.archived === true,
        order: num(d.sortOrder) ?? 0,
        importMapping: d.importMapping ?? undefined,
      });
    case 'categories':
      // System categories (Opening balances, Fees…) live in the app's chart already.
      if (d.system) return null;
      return rec('categories', id, {
        name: d.name,
        kind: d.kind,
        group: d.groupId,
        key: str(d.starterKey),
        icon: str(d.icon),
        hidden: d.hidden === true,
        countInBudget: d.budgetable !== false,
        order: num(d.sortOrder) ?? 0,
        budgetType: d.type === 'non_monthly' ? 'nonMonthly' : (d.type ?? 'flexible'),
        carryOver: d.carryOver === true,
        essential: d.essential === true ? true : undefined,
      });
    case 'category_groups':
      return rec('category_groups', id, { name: d.name, kind: d.kind, order: num(d.sortOrder) ?? 0 });
    case 'payees':
      return rec('payees', id, {
        name: d.name,
        defaultCategoryId: str(d.defaultCategoryId),
        aliases: Array.isArray(d.aliases) ? d.aliases : [],
        logoUri: str(d.logoUrl),
      });
    case 'tags':
      return rec('tags', id, { name: d.name });
    case 'budget_months': {
      const categoryId = str(d.categoryId);
      const month = id.split(':')[1];
      if (!categoryId || !month) return null;
      return rec('budget_assigns', id, { categoryId, month, amountMinor: String(d.assigned ?? '0') });
    }
    case 'schedules': {
      const start = String(d.startDate);
      const end = (d.end as Doc | undefined) ?? {};
      const reminder = d.reminder as Doc | null | undefined;
      const days = Array.isArray(reminder?.daysBefore) ? (reminder!.daysBefore as number[]) : [];
      const data: Omit<Recurring, 'id'> = {
        kind: d.kind as Recurring['kind'],
        name: String(d.name),
        amountMinor: String(d.amount),
        approximate: d.amountApproximate === true,
        accountId: str(d.accountId) ?? '',
        categoryId: str(d.categoryId),
        payeeId: str(d.payeeId),
        rule: recurrenceFromServer(d.recurrence as Doc, start),
        startDate: start,
        endDate: end.kind === 'on' ? str(end.date) : undefined,
        endAfterCount: end.kind === 'after' ? num(end.count) : undefined,
        autoCreate: d.autoPost === true,
        reminderDays: days[0],
        hideAmountOnLock: reminder ? reminder.hideAmountOnLockScreen !== false : true,
        cancelled: d.status === 'cancelled',
      };
      return rec('recurring', id, data);
    }
    case 'occurrences': {
      const scheduleId = String(d.scheduleId);
      const date = String(d.date);
      const status: RecurringOccurrence['status'] =
        d.status === 'paid' || d.status === 'received' ? 'paid' : d.status === 'missed' ? 'missed' : 'upcoming';
      // The app keys occurrences by schedule and date, so a match made on either side lands on one record.
      return rec('occurrences', `${scheduleId}:${date}`, {
        recurringId: scheduleId,
        dueDate: date,
        amountMinor: String(d.amount),
        status,
        eventId: str(d.matchedTransactionId),
      });
    }
    case 'debts': {
      const instalments = d.instalments as Doc | null | undefined;
      const data: Omit<PersonDebt, 'id'> = {
        name: String(d.personName),
        direction: d.direction === 'they_owe_me' ? 'owedToMe' : 'iOwe',
        ledgerAccountId: String(d.ledgerAccountId),
        payeeId: str(d.payeeId),
        status: d.status === 'open' ? 'open' : 'settled',
        nextDueDate: str(d.nextInstalmentDate) ?? str(d.dueDate),
        notes: str(d.notes),
        scheduleInstallmentCount: num(instalments?.count),
        scheduleAmountMinor: minorOrUndefined(instalments?.amount),
        scheduleEvery: instalments ? 'month' : undefined,
        scheduleFirstDue: str(instalments?.firstDate),
      };
      return rec('debts', id, data);
    }
    case 'goals': {
      const schedule = d.schedule as Doc | null | undefined;
      const data: Omit<Goal, 'id'> = {
        name: String(d.name),
        targetMinor: String(d.targetAmount),
        targetDate: str(d.targetDate),
        accountId: String(d.accountId),
        categoryId: str(d.categoryId),
        status: d.status === 'in_progress' ? 'active' : (d.status as Goal['status']),
        scheduleAmountMinor: minorOrUndefined(schedule?.amount),
        scheduleDayOfMonth: num((schedule?.recurrence as Doc | undefined)?.dayOfMonth),
      };
      return rec('goals', id, data);
    }
    case 'goal_allocations': {
      const spend = d.kind === 'spend';
      const amount = String(d.amount);
      return rec('allocations', id, {
        goalId: d.goalId,
        amountMinor: spend && !amount.startsWith('-') ? `-${amount}` : amount,
        date: d.date,
        fromAccountId: str(d.fromAccountId) ?? '',
        kind: spend ? 'spend' : 'allocate',
      });
    }
    case 'reconciliations': {
      // Only finished reconciles belong in Account Details history (TB03-3).
      if (d.status && d.status !== 'finished') return null;
      const statement = String(d.statementBalance ?? d.statementBalanceMinor ?? '0');
      const cleared = String(d.cleared ?? statement);
      return rec('reconciles', id, {
        accountId: String(d.accountId),
        statementDate: String(d.statementDate),
        statementBalance: statement,
        calculatedBalance: cleared,
        adjustment: '0',
        finishedAt: str(d.finishedAt) ?? new Date(0).toISOString(),
        finishedBy: str(d.finishedBy),
      });
    }
    case 'income_streams': {
      const start = String(d.startDate);
      const range = d.amountRange as Doc | null | undefined;
      const reminder = d.reminder as Doc | null | undefined;
      const days = Array.isArray(reminder?.daysBefore) ? (reminder!.daysBefore as number[]) : [];
      const data: Omit<IncomeStream, 'id'> = {
        name: String(d.name),
        kind: STREAM_KIND_FROM[String(d.streamKind)] ?? 'regular',
        expectedMinor: String(d.amount),
        accountId: str(d.accountId) ?? '',
        categoryId: str(d.categoryId) ?? '',
        rule: recurrenceFromServer(d.recurrence as Doc, start),
        countInBudget: d.countInBudget !== false,
        taxClass: str(d.taxClass),
        amountKind: range ? 'range' : d.amountApproximate ? 'approximate' : 'exact',
        rangeMinMinor: minorOrUndefined(range?.min),
        rangeMaxMinor: minorOrUndefined(range?.max),
        recordMode: d.recordAs === 'gross' ? 'gross' : 'takeHome',
        grossMinor: minorOrUndefined(d.grossAmount),
        reminder: days.length === 0 ? 'none' : days[0] === 0 ? 'sameDay' : (String(days[0]) as IncomeStream['reminder']),
      };
      return rec('income_streams', id, data);
    }
    case 'rules':
      return rec('rules', id, {
        enabled: d.enabled === true,
        stage: d.stage,
        order: num(d.order) ?? 0,
        matchMode: d.matchMode,
        conditions: d.conditions ?? [],
        actions: d.actions ?? [],
        matchedCount: num(d.matchedCount) ?? 0,
        lastUsedAt: str(d.lastUsedAt),
      });
    default:
      return null;
  }
}

/* ---------- The app's Phase 2 records → API bodies ---------- */

const reminderOf = (days: number | undefined, hide: boolean | undefined) =>
  days === undefined ? null : { daysBefore: [days], hideAmountOnLockScreen: hide !== false };

export function scheduleBody(id: string, r: Omit<Recurring, 'id'>) {
  return {
    id,
    kind: r.kind,
    name: r.name,
    payeeId: r.payeeId ?? null,
    accountId: r.accountId || null,
    categoryId: r.categoryId ?? null,
    amount: r.amountMinor,
    amountApproximate: r.approximate === true,
    recurrence: recurrenceToServer(r.rule),
    startDate: r.startDate,
    end: r.endAfterCount ? { kind: 'after', count: r.endAfterCount } : r.endDate ? { kind: 'on', date: r.endDate } : { kind: 'never' },
    autoPost: r.autoCreate === true,
    reminder: reminderOf(r.reminderDays, r.hideAmountOnLock),
  };
}

export function scheduleUpdateBody(r: Omit<Recurring, 'id'>, baseVersion: number) {
  const { id: _id, kind: _kind, ...rest } = scheduleBody('', r);
  return { ...rest, baseVersion, status: r.cancelled ? undefined : 'active' };
}

const percentToBasisPoints = (p: number | undefined) => (p === undefined ? undefined : Math.round(p * 100));

export function incomeStreamBody(id: string, s: Omit<IncomeStream, 'id'>, startDate: string) {
  const reminderDays = s.reminder === undefined || s.reminder === 'none' ? undefined : s.reminder === 'sameDay' ? 0 : Number(s.reminder);
  return {
    id,
    name: s.name,
    streamKind: STREAM_KIND_TO[s.kind],
    accountId: s.accountId,
    categoryId: s.categoryId,
    amount: s.expectedMinor,
    amountRange: s.amountKind === 'range' && s.rangeMinMinor && s.rangeMaxMinor ? { min: s.rangeMinMinor, max: s.rangeMaxMinor } : null,
    amountApproximate: s.amountKind === 'approximate',
    recurrence: recurrenceToServer(s.rule),
    startDate,
    taxClass: (['paye', 'self_employed', 'rental', 'investment', 'other'].includes(s.taxClass ?? '') ? s.taxClass : 'other') as string,
    countInBudget: s.countInBudget,
    recordAs: s.recordMode === 'gross' ? 'gross' : 'take_home',
    grossAmount: s.grossMinor ?? null,
    deductions: (s.deductions ?? []).map((x) => ({
      label: x.label ?? x.kind,
      amount: x.amountMinor,
      percentBasisPoints: percentToBasisPoints(x.percent),
      categoryId: x.targetCategoryId ?? null,
      ledgerAccountId: x.targetAccountId ?? null,
    })),
    routing: (s.routing ?? []).map((x) => ({
      goalId: x.goalId ?? null,
      categoryId: x.categoryId ?? null,
      amount: x.amountMinor,
      percentBasisPoints: percentToBasisPoints(x.percent),
      remainderToBudget: x.restToBudget === true,
    })),
    reminder: reminderOf(reminderDays, true),
  };
}

export function incomeStreamUpdateBody(s: Omit<IncomeStream, 'id'>, baseVersion: number) {
  const { id: _id, recurrence: _r, startDate: _s, reminder: _m, ...rest } = incomeStreamBody('', s, '');
  return { ...rest, baseVersion };
}

export function goalBody(id: string, g: Omit<Goal, 'id'>) {
  return {
    id,
    name: g.name,
    targetAmount: g.targetMinor,
    targetDate: g.targetDate ?? null,
    accountId: g.accountId,
    categoryId: g.categoryId ?? null,
  };
}

export function goalUpdateBody(g: Omit<Goal, 'id'>, baseVersion: number) {
  const { id: _id, ...rest } = goalBody('', g);
  return { ...rest, baseVersion, status: g.status === 'active' ? 'in_progress' : g.status };
}
