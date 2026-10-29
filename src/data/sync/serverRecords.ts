import type {
  AccountKind,
  DebtInterest,
  Goal,
  IncomeDeduction,
  IncomeDeductionKind,
  IncomeRouting,
  HoldingType,
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

const TAX_CLASS_TO_SERVER: Record<string, string> = {
  PAYE: 'paye',
  'Self-employed': 'self_employed',
  Rental: 'rental',
  Investment: 'investment',
  Other: 'other',
  paye: 'paye',
  self_employed: 'self_employed',
  rental: 'rental',
  investment: 'investment',
  other: 'other',
};

const TAX_CLASS_FROM_SERVER: Record<string, string> = {
  paye: 'PAYE',
  self_employed: 'Self-employed',
  rental: 'Rental',
  investment: 'Investment',
  other: 'Other',
};

function taxClassToServer(v: string | undefined): string {
  if (!v) return 'other';
  return TAX_CLASS_TO_SERVER[v] ?? 'other';
}

function taxClassFromServer(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  return TAX_CLASS_FROM_SERVER[s] ?? s;
}

function deductionKindFromLabel(label: string | undefined): IncomeDeductionKind {
  const l = (label ?? '').toLowerCase();
  if (l.includes('paye') || l.includes('tax')) return 'paye';
  if (l.includes('pension')) return 'pension';
  if (l.includes('nhf')) return 'nhf';
  return 'other';
}

function deductionsFromServer(raw: unknown): IncomeDeduction[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((row) => {
    const d = row as Doc;
    const label = str(d.label);
    return {
      kind: deductionKindFromLabel(label),
      label,
      amountMinor: minorOrUndefined(d.amount),
      percent: typeof d.percentBasisPoints === 'number' ? d.percentBasisPoints / 100 : undefined,
      targetCategoryId: str(d.categoryId) ?? undefined,
      targetAccountId: str(d.ledgerAccountId) ?? undefined,
    };
  });
}

function routingFromServer(raw: unknown): IncomeRouting[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((row) => {
    const d = row as Doc;
    return {
      goalId: str(d.goalId) ?? undefined,
      categoryId: str(d.categoryId) ?? undefined,
      amountMinor: minorOrUndefined(d.amount),
      percent: typeof d.percentBasisPoints === 'number' ? d.percentBasisPoints / 100 : undefined,
      restToBudget: d.remainderToBudget === true,
    };
  });
}

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
    oneOff: doc.oneOff === true ? true : undefined,
    holdingId: str(links.holdingId) ?? str(doc.holdingId),
    investmentUnits: str((doc.investment as Doc | undefined)?.units),
    investmentPriceMinor: str((doc.investment as Doc | undefined)?.price),
    investmentFeesMinor: str((doc.investment as Doc | undefined)?.fees),
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
        paused: d.status === 'paused',
        toAccountId: str(d.toAccountId),
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
      const interest = interestFromServer(d.interest as Doc | undefined);
      const status: PersonDebt['status'] =
        d.status === 'open' ? 'open' : d.status === 'written_off' ? 'written_off' : 'settled';
      const data: Omit<PersonDebt, 'id'> = {
        name: String(d.personName),
        direction: d.direction === 'they_owe_me' ? 'owedToMe' : 'iOwe',
        ledgerAccountId: String(d.ledgerAccountId),
        payeeId: str(d.payeeId),
        status,
        nextDueDate: str(d.nextInstalmentDate) ?? str(d.dueDate),
        notes: str(d.notes),
        interest,
        accountId: str(d.accountId),
        openedOn: str(d.openedOn),
        scheduleInstallmentCount: num(instalments?.count),
        scheduleAmountMinor: minorOrUndefined(instalments?.amount),
        scheduleEvery: instalments
          ? num(instalments.everyWeeks) != null
            ? 'week'
            : 'month'
          : undefined,
        scheduleFirstDue: str(instalments?.firstDate),
      };
      return rec('debts', id, data);
    }
    case 'goals': {
      const schedule = d.schedule as Doc | null | undefined;
      const recurrence = schedule?.recurrence as Doc | undefined;
      const unit = str(recurrence?.unit);
      const data: Omit<Goal, 'id'> = {
        name: String(d.name),
        icon: str(d.icon),
        notes: str(d.notes),
        targetMinor: String(d.targetAmount),
        targetDate: str(d.targetDate),
        accountId: String(d.accountId),
        categoryId: str(d.categoryId),
        status: d.status === 'in_progress' ? 'active' : (d.status as Goal['status']),
        completedAt: str(d.completedAt) ?? undefined,
        scheduleAmountMinor: minorOrUndefined(schedule?.amount),
        scheduleDayOfMonth: num(recurrence?.dayOfMonth) ?? (unit === 'week' ? num(recurrence?.weekday) : undefined),
        scheduleEvery: unit === 'week' || unit === 'month' ? unit : undefined,
        scheduleStarts: str(schedule?.startDate),
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
        transactionId: str(d.transactionId),
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
        taxClass: taxClassFromServer(d.taxClass),
        source: str(d.employerOrSource) ?? undefined,
        amountKind: range ? 'range' : d.amountApproximate ? 'approximate' : 'exact',
        rangeMinMinor: minorOrUndefined(range?.min),
        rangeMaxMinor: minorOrUndefined(range?.max),
        recordMode: d.recordAs === 'gross' ? 'gross' : 'takeHome',
        grossMinor: minorOrUndefined(d.grossAmount),
        deductions: deductionsFromServer(d.deductions),
        routing: routingFromServer(d.routing),
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
    case 'holdings': {
      const type = holdingTypeFromServer(String(d.type));
      return rec('holdings', id, {
        name: String(d.name),
        symbol: str(d.symbol) || undefined,
        type,
        accountId: String(d.accountId),
        currency: String(d.currency ?? 'NGN'),
        // BE: holding id is the ledger account id (TECH-SPEC 6.1).
        ledgerAccountId: id,
      });
    }
    case 'prices':
      return rec('prices', id, {
        holdingId: String(d.holdingId),
        date: String(d.date),
        priceMinor: String(d.price ?? d.priceMinor ?? '0'),
      });
    case 'report_dashboards':
      return rec('report_dashboards', id, { name: d.name, sortOrder: num(d.sortOrder) ?? 0, cards: Array.isArray(d.cards) ? d.cards : [] });
    case 'saved_reports':
      return rec('saved_reports', id, { name: d.name, spec: d.spec });
    default:
      return null;
  }
}

const HOLDING_TYPE_FROM: Record<string, HoldingType> = {
  stock: 'stock',
  fund: 'fund',
  pension: 'pension',
  crypto: 'crypto',
  fixed_deposit: 'fixedDeposit',
  fixedDeposit: 'fixedDeposit',
  other: 'other',
};

const HOLDING_TYPE_TO: Record<HoldingType, string> = {
  stock: 'stock',
  fund: 'fund',
  pension: 'pension',
  crypto: 'crypto',
  fixedDeposit: 'fixed_deposit',
  other: 'other',
};

export function holdingTypeFromServer(type: string): HoldingType {
  return HOLDING_TYPE_FROM[type] ?? 'other';
}

export function holdingTypeToServer(type: HoldingType): string {
  return HOLDING_TYPE_TO[type] ?? 'other';
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
    toAccountId: r.toAccountId ?? null,
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
  // Cancel goes through schedule.cancel; update only carries active|paused.
  return { ...rest, baseVersion, status: r.paused ? 'paused' : 'active' };
}

const percentToBasisPoints = (p: number | undefined) => (p === undefined ? undefined : Math.round(p * 100));

export function incomeStreamBody(id: string, s: Omit<IncomeStream, 'id'>, startDate: string) {
  const reminderDays = s.reminder === undefined || s.reminder === 'none' ? undefined : s.reminder === 'sameDay' ? 0 : Number(s.reminder);
  return {
    id,
    name: s.name,
    employerOrSource: s.source?.trim() ? s.source.trim() : null,
    streamKind: STREAM_KIND_TO[s.kind],
    accountId: s.accountId,
    categoryId: s.categoryId,
    amount: s.expectedMinor,
    amountRange: s.amountKind === 'range' && s.rangeMinMinor && s.rangeMaxMinor ? { min: s.rangeMinMinor, max: s.rangeMaxMinor } : null,
    amountApproximate: s.amountKind === 'approximate',
    recurrence: recurrenceToServer(s.rule),
    startDate,
    taxClass: taxClassToServer(s.taxClass),
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
    icon: g.icon ?? null,
    notes: g.notes ?? null,
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

/** PUT /goals/:id/schedule body (PU-33 / sync `goal.schedule`). */
export function goalScheduleBody(g: Omit<Goal, 'id'>, baseVersion: number) {
  const every = g.scheduleEvery ?? 'month';
  const on = g.scheduleDayOfMonth ?? 1;
  const rule: RecurrenceRule =
    every === 'week'
      ? { every: 'week', on: Math.min(6, Math.max(0, on)), interval: 1 }
      : { every: 'month', on: Math.min(31, Math.max(1, on)), interval: 1 };
  return {
    baseVersion,
    amount: g.scheduleAmountMinor ?? '0',
    recurrence: recurrenceToServer(rule),
    startDate: g.scheduleStarts ?? new Date().toISOString().slice(0, 10),
  };
}

/** Server InterestTerms → local DebtInterest (TECH-SPEC 6.9). */
export function interestFromServer(interest: Doc | undefined): DebtInterest | undefined {
  if (!interest || typeof interest.kind !== 'string') return undefined;
  if (interest.kind === 'none') return { kind: 'none' };
  if (interest.kind === 'fixed') {
    const amount = minorOrUndefined(interest.amount);
    return amount ? { kind: 'fixed', amountMinor: amount } : { kind: 'none' };
  }
  if (interest.kind === 'percent') {
    const bps = num(interest.rateBasisPoints) ?? 0;
    return { kind: 'percent_month', percent: bps / 100 };
  }
  return undefined;
}

export function interestToServer(interest: DebtInterest | undefined) {
  if (!interest || interest.kind === 'none') return { kind: 'none' as const };
  if (interest.kind === 'fixed') return { kind: 'fixed' as const, amount: interest.amountMinor };
  return { kind: 'percent' as const, rateBasisPoints: Math.round(interest.percent * 100) };
}

/** Local schedule fields → BE InstalmentSchedule for PUT …/schedule. */
export function debtInstalmentsFromLocal(d: Omit<PersonDebt, 'id'>) {
  if (!d.scheduleInstallmentCount || !d.scheduleAmountMinor || !d.scheduleFirstDue || !d.scheduleEvery) return null;
  const instalments: {
    count: number;
    amount: string;
    firstDate: string;
    everyMonths: number;
    everyWeeks?: number;
  } = {
    count: d.scheduleInstallmentCount,
    amount: d.scheduleAmountMinor,
    firstDate: d.scheduleFirstDue,
    everyMonths: 1,
  };
  if (d.scheduleEvery === 'week') instalments.everyWeeks = 1;
  return instalments;
}

export function debtUpdateBody(d: Omit<PersonDebt, 'id'>, baseVersion: number) {
  return {
    baseVersion,
    notes: d.notes ?? null,
    interest: interestToServer(d.interest),
    dueDate: d.nextDueDate ?? null,
  };
}

export function debtScheduleBody(d: Omit<PersonDebt, 'id'>, baseVersion: number) {
  const instalments = debtInstalmentsFromLocal(d);
  if (!instalments) return null;
  return { baseVersion, instalments };
}
