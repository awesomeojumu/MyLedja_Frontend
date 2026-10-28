import { v7 as uuidv7 } from 'uuid';

import type { SetupBody } from '@/api/auth';
import { formatDay } from '@/design/components/overlays';
import { t, type TextKey } from '@/i18n';
import {
  buildAdjustment,
  buildCollect,
  buildExpense,
  buildIncome,
  buildLend,
  buildLoanProceeds,
  buildLoanRepayment,
  buildOpeningBalance,
  buildRefund,
  buildReversal,
  buildTransfer,
  buildWriteOff,
  Chart,
  checkEvent,
  ledgerBalance,
  reconcileDelta,
  shownBalance,
  systemAccounts,
  monthOf,
  type ExpensePart,
  type LedgerAccount,
  type LedgerErrorCode,
  type Line,
  type MoneyEvent,
} from '@/ledger';

import type { LocalStore } from '../sync/LocalStore';
import type { SyncEngine } from '../sync/SyncEngine';
import type { LocalRecord } from '../sync/types';
import {
  ACCOUNT_KIND_INFO,
  fromStored,
  STARTER_INCOME,
  toStored,
  type Account,
  type AccountKind,
  type BudgetTemplate,
  DEFAULT_NOTIFICATION_PREFS,
  type Category,
  type EventMeta,
  type ImportMapping,
  type Goal,
  type GoalAllocation,
  type AppNotification,
  type PersonDebt,
  type DebtEntry,
  type Recurring,
  type RecurringOccurrence,
  type RecurrenceRule,
  type IncomeStream,
  type Payee,
  type Reconcile,
  type StoredEvent,
  type WorkspaceSettings,
  budgetAssignId,
} from './model';

export type TxEvent = MoneyEvent & EventMeta;

export type Snapshot = {
  workspaceId: string;
  settings: WorkspaceSettings;
  accounts: Account[];
  categories: Category[];
  payees: Payee[];
  events: TxEvent[];
  reconciles: Reconcile[];
  /** categoryId:month → assigned kobo */
  assigns: Map<string, bigint>;
  goals: Goal[];
  allocations: GoalAllocation[];
  recurring: Recurring[];
  occurrences: RecurringOccurrence[];
  incomeStreams: IncomeStream[];
  debts: PersonDebt[];
  debtEntries: DebtEntry[];
  notifications: AppNotification[];
  budgetTemplates: BudgetTemplate[];
  /** Events made on this device that haven't synced yet. */
  waiting: Set<string>;
  chart: Chart;
};

export type ImportRow = { date: string; amount: bigint; categoryId: string; payeeName?: string; notes?: string };

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: LedgerErrorCode };

function workspaceToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function billDueInMonth(rule: RecurrenceRule, month: string): string | null {
  const [y, m] = month.split('-').map(Number) as [number, number];
  if (rule.every !== 'month') return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = rule.on === 31 ? last : Math.min(rule.on, last);
  return `${month}-${String(day).padStart(2, '0')}`;
}

export type TransactionInput =
  | { kind: 'expense'; accountId: string; parts: ExpensePart[]; date: string; payeeName?: string; notes?: string }
  | { kind: 'income'; accountId: string; categoryId: string; amount: bigint; date: string; payeeName?: string; notes?: string }
  | { kind: 'transfer'; fromId: string; toId: string; amount: bigint; date: string; notes?: string };

const record = (collection: string, id: string, data: object, version = 0): LocalRecord => ({
  id,
  collection,
  version,
  data: data as Record<string, unknown>,
});

/** Reads and writes the workspace through the local store; every write is queued for sync. */
export class WorkspaceRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly engine: SyncEngine,
    readonly workspaceId: string,
    private readonly newId: () => string = uuidv7,
  ) {}

  async load(): Promise<Snapshot> {
    const [accounts, categories, payees, events, outbox, reconciles, settingsRows, assignRows, goalRows, allocationRows, recurringRows, occurrenceRows, streamRows, debtRows, debtEntryRows, notificationRows, templateRows] =
      await Promise.all([
      this.store.list('accounts'),
      this.store.list('categories'),
      this.store.list('payees'),
      this.store.list('events'),
      this.store.outbox(),
      this.store.list('reconciles'),
      this.store.list('settings'),
      this.store.list('budget_assigns'),
      this.store.list('goals'),
      this.store.list('allocations'),
      this.store.list('recurring'),
      this.store.list('occurrences'),
      this.store.list('income_streams'),
      this.store.list('debts'),
      this.store.list('debt_entries'),
      this.store.list('notifications'),
      this.store.list('budget_templates'),
    ]);
    const reversedIds = new Set(events.map((e) => (e.data as StoredEvent).reversalOf).filter(Boolean));
    const accountList = accounts.map((r) => ({ ...(r.data as Omit<Account, 'id'>), id: r.id })).sort((a, b) => a.order - b.order);
    const categoryList = categories
      .map((r) => {
        const data = r.data as Omit<Category, 'id'>;
        return {
          ...data,
          id: r.id,
          order: data.order ?? 0,
          budgetType: data.budgetType ?? 'flexible',
          carryOver: data.carryOver ?? false,
        } satisfies Category;
      })
      .filter((c) => !c.deleted)
      .sort((a, b) => a.order - b.order);
    const eventList = events
      .map((r) => fromStored(r.id, String(r.data.operationId ?? r.id), r.data as StoredEvent, reversedIds.has(r.id)))
      .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
    const waiting = new Set(
      outbox.filter((o) => (o.payload as { collection?: string }).collection === 'events').map((o) => String((o.payload as { id: string }).id)),
    );
    const settingsRow = settingsRows.find((r) => r.id === 'workspace');
    const raw = settingsRow?.data as WorkspaceSettings | undefined;
    const settings: WorkspaceSettings = {
      budgetStyle: raw?.budgetStyle ?? 'tracking',
      currency: raw?.currency ?? 'NGN',
      weekStart: raw?.weekStart ?? 'monday',
      checklistHidden: raw?.checklistHidden,
      dashboardLayout: raw?.dashboardLayout,
      notificationPrefs: {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...raw?.notificationPrefs,
        billReminderDays: raw?.notificationPrefs?.billReminderDays ?? DEFAULT_NOTIFICATION_PREFS.billReminderDays,
      },
      aiPrefs: raw?.aiPrefs,
      carryOverDefault: raw?.carryOverDefault,
      budgetTypesShown: raw?.budgetTypesShown,
      exchangeRates: raw?.exchangeRates,
      downloadDailyRates: raw?.downloadDailyRates,
      deviceSync: raw?.deviceSync,
    };
    const assigns = new Map<string, bigint>();
    for (const r of assignRows) {
      const d = r.data as { categoryId: string; month: string; amountMinor: string };
      assigns.set(budgetAssignId(d.categoryId, d.month), BigInt(d.amountMinor));
    }
    return {
      workspaceId: this.workspaceId,
      settings,
      accounts: accountList,
      categories: categoryList,
      payees: payees
        .map((r) => ({ ...(r.data as Omit<Payee, 'id'>), id: r.id }))
        .filter((p) => !p.deleted),
      events: eventList,
      reconciles: reconciles.map((r) => ({ ...(r.data as Omit<Reconcile, 'id'>), id: r.id })).sort((a, b) => b.statementDate.localeCompare(a.statementDate)),
      assigns,
      goals: goalRows.map((r) => ({ ...(r.data as Omit<Goal, 'id'>), id: r.id })),
      allocations: allocationRows.map((r) => ({ ...(r.data as Omit<GoalAllocation, 'id'>), id: r.id })),
      recurring: recurringRows.map((r) => ({ ...(r.data as Omit<Recurring, 'id'>), id: r.id })),
      occurrences: occurrenceRows.map((r) => ({ ...(r.data as Omit<RecurringOccurrence, 'id'>), id: r.id })),
      incomeStreams: streamRows.map((r) => ({ ...(r.data as Omit<IncomeStream, 'id'>), id: r.id })),
      debts: debtRows.map((r) => ({ ...(r.data as Omit<PersonDebt, 'id'>), id: r.id })),
      debtEntries: debtEntryRows.map((r) => ({ ...(r.data as Omit<DebtEntry, 'id'>), id: r.id })),
      notifications: notificationRows
        .map((r) => ({ ...(r.data as Omit<AppNotification, 'id'>), id: r.id }))
        .filter((n) => !n.snoozedUntil || n.snoozedUntil <= workspaceToday()),
      budgetTemplates: templateRows.map((r) => ({ ...(r.data as Omit<BudgetTemplate, 'id'>), id: r.id })),
      waiting,
      chart: this.chartFor(accountList, categoryList, debtRows.map((r) => ({ ...(r.data as Omit<PersonDebt, 'id'>), id: r.id }))),
    };
  }

  chartFor(accounts: Account[], categories: Category[], debts: PersonDebt[] = []): Chart {
    const ledger: LedgerAccount[] = [
      ...accounts.map((a) => ({ id: a.id, kind: ACCOUNT_KIND_INFO[a.type].ledger, name: a.name, currency: a.currency })),
      ...categories.map((c) => ({ id: c.id, kind: c.kind, name: c.name, currency: 'NGN', categoryId: c.id, countInBudget: c.countInBudget })),
      ...debts.map((d) => ({
        id: d.ledgerAccountId,
        kind: d.direction === 'owedToMe' ? ('asset' as const) : ('liability' as const),
        name: d.name,
        currency: 'NGN',
      })),
      ...systemAccounts(this.workspaceId),
    ];
    return new Chart(ledger);
  }

  private async put(collection: string, id: string, data: object, type: string, baseVersion?: number) {
    await this.engine.save(record(collection, id, data, baseVersion ?? 0), type, { collection, id, data }, baseVersion);
  }

  /** After Welcome: the accounts, categories and opening balances the person chose. */
  async seedFromSetup(body: SetupBody): Promise<void> {
    if ((await this.store.list('categories')).length > 0) return;
    for (const [i, c] of body.categories.entries()) {
      const key = c.key.startsWith('cat.') ? (c.key as TextKey) : undefined;
      await this.put(
        'categories',
        this.newId(),
        {
          name: c.name,
          kind: 'expense',
          group: c.group,
          key,
          hidden: false,
          countInBudget: true,
          order: i,
          budgetType: 'flexible',
          carryOver: false,
        },
        'category.create',
      );
    }
    for (const key of STARTER_INCOME) {
      await this.put(
        'categories',
        this.newId(),
        {
          name: t(key),
          kind: 'income',
          group: 'group.income',
          key,
          hidden: false,
          countInBudget: key !== 'cat.gift',
          order: body.categories.length + STARTER_INCOME.indexOf(key),
          budgetType: 'flexible',
          carryOver: false,
        },
        'category.create',
      );
    }
    await this.put(
      'settings',
      'workspace',
      { budgetStyle: body.budgetStyle, currency: body.currency, weekStart: body.weekStart },
      'settings.update',
    );
    for (const a of body.accounts) {
      const type = (a.type in ACCOUNT_KIND_INFO ? a.type : 'other') as AccountKind;
      await this.addAccount({ name: a.name, type, openingBalance: BigInt(a.openingBalance), openingDate: a.openingDate });
    }
  }

  async addAccount(input: {
    name: string;
    type: AccountKind;
    institution?: string;
    last4?: string;
    countInBudget?: boolean;
    openingBalance: bigint;
    openingDate: string;
  }): Promise<Result<Account>> {
    const snapshot = await this.load();
    const account: Account = {
      id: this.newId(),
      name: input.name,
      type: input.type,
      currency: 'NGN',
      institution: input.institution,
      last4: input.last4?.slice(-4),
      countInBudget: input.countInBudget ?? ACCOUNT_KIND_INFO[input.type].countInBudget,
      archived: false,
      order: snapshot.accounts.length,
    };
    const { id, ...data } = account;
    await this.put('accounts', id, data, 'account.create');
    if (input.openingBalance > 0n) {
      const chart = this.chartFor([...snapshot.accounts, account], snapshot.categories);
      const lines = buildOpeningBalance(chart, { accountId: id, amount: input.openingBalance });
      if (!lines.ok) return lines;
      await this.postEvent(chart, snapshot.events, { type: 'opening_balance', date: input.openingDate, lines: lines.value });
    }
    return { ok: true, value: account };
  }

  async updateAccount(account: Account): Promise<void> {
    const { id, ...data } = account;
    await this.put('accounts', id, { ...data, last4: data.last4?.slice(-4) }, 'account.update');
  }

  async addTransaction(input: TransactionInput): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const { chart } = snapshot;
    let lines;
    let splitTotal: bigint | undefined;
    if (input.kind === 'expense') {
      lines = buildExpense(chart, { accountId: input.accountId, parts: input.parts });
      if (input.parts.length > 1) splitTotal = input.parts.reduce((s, p) => s + p.amount, 0n);
    } else if (input.kind === 'income') {
      lines = buildIncome(chart, { accountId: input.accountId, categoryId: input.categoryId, amount: input.amount });
    } else {
      lines = buildTransfer(chart, { fromId: input.fromId, toId: input.toId, amount: input.amount });
    }
    if (!lines.ok) return lines;
    const payeeName = input.kind === 'transfer' ? undefined : input.payeeName?.trim();
    const payeeId = payeeName
      ? await this.payeeFor(
          snapshot.payees,
          payeeName,
          input.kind === 'expense' ? input.parts[0]?.categoryId : input.kind === 'income' ? input.categoryId : undefined,
        )
      : undefined;
    return this.postEvent(chart, snapshot.events, {
      type: input.kind,
      date: input.date,
      lines: lines.value,
      splitTotal,
      payeeId,
      notes: input.notes?.trim() || undefined,
    });
  }

  /** "Delete": a reversal (TECH-SPEC 6.3). Undo reverses the reversal's effect by posting the original again. */
  async deleteTransaction(id: string, date: string): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const original = snapshot.events.find((e) => e.id === id);
    if (!original) return { ok: false, error: 'missing_lines' };
    if (original.reconciledBy) return { ok: false, error: 'reconciled' };
    return this.postEvent(snapshot.chart, snapshot.events, { type: 'reversal', date, lines: buildReversal(original), reversalOf: id });
  }

  /** Undo of a delete: the original movement again, as a new event. */
  async restore(original: TxEvent): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const { type, date, lines, splitTotal, payeeId, notes, refundOf } = original;
    return this.postEvent(snapshot.chart, snapshot.events, { type, date, lines, splitTotal, payeeId, notes, refundOf });
  }

  /** Changing amount, date, account or category: a reversal and the corrected event (TECH-SPEC 6.3, case 21). */
  async correctTransaction(id: string, input: TransactionInput): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const original = snapshot.events.find((e) => e.id === id);
    if (!original) return { ok: false, error: 'missing_lines' };
    if (original.status === 'reversed') return { ok: false, error: 'already_reversed' };
    if (original.reconciledBy) return { ok: false, error: 'reconciled' };
    const lines = this.linesFor(snapshot.chart, input);
    if (!lines.ok) return lines;
    const replacementId = this.newId();
    const replacement: TxEvent = {
      id: replacementId,
      operationId: replacementId,
      status: 'posted',
      type: input.kind,
      date: input.date,
      lines: lines.value.lines,
      splitTotal: lines.value.splitTotal,
      payeeId: original.payeeId,
      notes: input.notes?.trim() || original.notes,
      correctionOf: id,
    };
    const existing = new Map(snapshot.events.map((e) => [e.id, e]));
    const checked = checkEvent(snapshot.chart, replacement, existing);
    if (!checked.ok) return checked;
    const reversal = await this.postEvent(snapshot.chart, snapshot.events, {
      type: 'reversal',
      date: input.date,
      lines: buildReversal(original),
      reversalOf: id,
    });
    if (!reversal.ok) return reversal;
    const { id: _id, operationId: _op, status: _status, ...rest } = replacement;
    await this.put('events', replacementId, { ...toStored(rest), operationId: replacementId }, `event.${input.kind}`);
    return { ok: true, value: replacement };
  }

  /** E11: never more than what's left of the purchase (case 14). */
  async addRefund(originalId: string, input: { accountId: string; amount: bigint; date: string }): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const original = snapshot.events.find((e) => e.id === originalId);
    if (!original) return { ok: false, error: 'missing_lines' };
    const lines = buildRefund(snapshot.chart, { accountId: input.accountId, original, amount: input.amount });
    if (!lines.ok) return lines;
    return this.postEvent(snapshot.chart, snapshot.events, {
      type: 'refund',
      date: input.date,
      lines: lines.value,
      refundOf: originalId,
      payeeId: original.payeeId,
    });
  }

  /** Notes and payee may change in place; they don't affect any figure (TECH-SPEC 6.3). */
  async updateNotes(id: string, notes: string): Promise<void> {
    const rec = await this.store.read('events', id);
    if (!rec) return;
    const data = { ...(rec.data as StoredEvent), notes: notes.trim() || undefined };
    await this.engine.save({ ...rec, data }, 'event.notes', { collection: 'events', id, data }, rec.version);
  }

  /** E10: a new value for property or an untracked investment; the change goes to Revaluation, never income (P08-05). */
  async updateValue(accountId: string, value: bigint, date: string): Promise<Result<TxEvent | null>> {
    const snapshot = await this.load();
    const account = snapshot.chart.get(accountId);
    if (!account) return { ok: false, error: 'missing_lines' };
    const current = ledgerBalance(accountId, snapshot.events);
    const target = account.kind === 'liability' ? -value : value;
    if (target === current) return { ok: true, value: null };
    const lines = buildAdjustment(snapshot.chart, { accountId, delta: target - current, against: 'revaluation' });
    if (!lines.ok) return lines;
    return this.postEvent(snapshot.chart, snapshot.events, { type: 'balance_adjustment', date, lines: lines.value });
  }

  /** P08-06: a balance moves to another account first, then the account is archived. */
  async archiveAccount(accountId: string, date: string, moveToId?: string): Promise<Result> {
    const snapshot = await this.load();
    const account = snapshot.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'missing_lines' };
    const balance = ledgerBalance(accountId, snapshot.events);
    if (balance !== 0n) {
      if (!moveToId) return { ok: false, error: 'missing_lines' };
      const amount = balance > 0n ? balance : -balance;
      const lines =
        balance > 0n
          ? buildTransfer(snapshot.chart, { fromId: accountId, toId: moveToId, amount })
          : buildTransfer(snapshot.chart, { fromId: moveToId, toId: accountId, amount });
      if (!lines.ok) return lines;
      const posted = await this.postEvent(snapshot.chart, snapshot.events, { type: 'transfer', date, lines: lines.value });
      if (!posted.ok) return posted;
    }
    await this.updateAccount({ ...account, archived: true });
    return { ok: true, value: undefined };
  }

  async reorderAccounts(ids: string[]): Promise<void> {
    const snapshot = await this.load();
    for (const [order, id] of ids.entries()) {
      const account = snapshot.accounts.find((a) => a.id === id);
      if (account && account.order !== order) await this.updateAccount({ ...account, order });
    }
  }

  /** P09-02 to P09-05: posts the ticked rows as one batch; every row shares an import id so Undo can reverse exactly them. */
  async importRows(accountId: string, rows: ImportRow[], mapping: ImportMapping): Promise<Result<{ importId: string; count: number }>> {
    const snapshot = await this.load();
    const account = snapshot.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'missing_lines' };
    const importId = this.newId();
    const payees = [...snapshot.payees];
    const events = [...snapshot.events];
    let count = 0;
    for (const row of rows) {
      const kind = row.amount < 0n ? 'expense' : 'income';
      const amount = row.amount < 0n ? -row.amount : row.amount;
      const lines =
        kind === 'expense'
          ? buildExpense(snapshot.chart, { accountId, parts: [{ categoryId: row.categoryId, amount }] })
          : buildIncome(snapshot.chart, { accountId, categoryId: row.categoryId, amount });
      if (!lines.ok) return lines;
      let payeeId: string | undefined;
      const name = row.payeeName?.trim();
      if (name) {
        payeeId = await this.payeeFor(payees, name, row.categoryId);
        if (!payees.some((p) => p.id === payeeId)) payees.push({ id: payeeId, name, defaultCategoryId: row.categoryId });
      }
      const posted = await this.postEvent(snapshot.chart, events, {
        type: kind,
        date: row.date,
        lines: lines.value,
        payeeId,
        notes: row.notes?.trim() || undefined,
        importId,
      });
      if (!posted.ok) return posted;
      events.push(posted.value);
      count += 1;
    }
    await this.updateAccount({ ...account, importMapping: mapping });
    return { ok: true, value: { importId, count } };
  }

  /** Undo of an import: reverses every row it posted and nothing else (P09-04). */
  async undoImport(importId: string, date: string): Promise<number> {
    let undone = 0;
    for (;;) {
      const snapshot = await this.load();
      const next = snapshot.events.find((e) => e.importId === importId && e.status === 'posted' && e.type !== 'reversal');
      if (!next) return undone;
      const r = await this.deleteTransaction(next.id, date);
      if (!r.ok) return undone;
      undone += 1;
    }
  }

  /** In-place bookkeeping fields (Q-16): cleared, and the reconcile that locked an event. */
  async setEventMeta(id: string, meta: Pick<EventMeta, 'cleared' | 'reconciledBy'>): Promise<void> {
    const rec = await this.store.read('events', id);
    if (!rec) return;
    const data = { ...(rec.data as StoredEvent), ...meta };
    await this.engine.save({ ...rec, data }, 'event.meta', { collection: 'events', id, data }, rec.version);
  }

  /** P10-05: unlock a reconciled event so it can be corrected again. */
  async unlockEvent(id: string): Promise<void> {
    const rec = await this.store.read('events', id);
    if (!rec) return;
    const current = rec.data as StoredEvent;
    const data = { ...current, reconciledBy: undefined };
    await this.engine.save({ ...rec, data }, 'event.unlock', { collection: 'events', id, data }, rec.version);
  }

  /**
   * Finish a reconcile (P10): lock the ticked events, optionally post an E9 adjustment for the
   * remaining difference, and keep the bank's statement balance apart from the calculated one.
   */
  async finishReconcile(input: {
    accountId: string;
    statementDate: string;
    statementBalance: bigint;
    eventIds: string[];
    withAdjustment: boolean;
  }): Promise<Result<Reconcile>> {
    const snapshot = await this.load();
    const account = snapshot.accounts.find((a) => a.id === input.accountId);
    const ledger = snapshot.chart.get(input.accountId);
    if (!account || !ledger) return { ok: false, error: 'missing_lines' };

    const calculated = ledgerBalance(input.accountId, snapshot.events, input.statementDate);
    let adjustment = 0n;
    if (input.withAdjustment) {
      const shown = shownBalance(ledger, calculated);
      const delta = reconcileDelta(ledger, input.statementBalance, shown);
      if (delta !== 0n) {
        const lines = buildAdjustment(snapshot.chart, { accountId: input.accountId, delta, against: 'adjustments' });
        if (!lines.ok) return lines;
        const posted = await this.postEvent(snapshot.chart, snapshot.events, {
          type: 'balance_adjustment',
          date: input.statementDate,
          lines: lines.value,
        });
        if (!posted.ok) return posted;
        adjustment = delta;
      }
    }

    const reconcileId = this.newId();
    const after = await this.load();
    const calculatedAfter = ledgerBalance(input.accountId, after.events, input.statementDate);
    for (const id of input.eventIds) {
      await this.setEventMeta(id, { cleared: true, reconciledBy: reconcileId });
    }
    if (input.withAdjustment && adjustment !== 0n) {
      const adj = after.events.find(
        (e) =>
          e.type === 'balance_adjustment' &&
          e.status === 'posted' &&
          e.date === input.statementDate &&
          e.lines.some((l) => l.ledgerAccountId === input.accountId) &&
          !e.reconciledBy,
      );
      if (adj) await this.setEventMeta(adj.id, { cleared: true, reconciledBy: reconcileId });
    }

    const reconcile: Reconcile = {
      id: reconcileId,
      accountId: input.accountId,
      statementDate: input.statementDate,
      statementBalance: input.statementBalance.toString(),
      calculatedBalance: calculatedAfter.toString(),
      adjustment: adjustment.toString(),
      finishedAt: new Date().toISOString(),
    };
    const { id, ...data } = reconcile;
    await this.put('reconciles', id, data, 'reconcile.finish');
    return { ok: true, value: reconcile };
  }

  assigned(categoryId: string, month: string, snapshot: Snapshot): bigint {
    return snapshot.assigns.get(budgetAssignId(categoryId, month)) ?? 0n;
  }

  async setAssigned(categoryId: string, month: string, amount: bigint): Promise<void> {
    const id = budgetAssignId(categoryId, month);
    await this.put('budget_assigns', id, { categoryId, month, amountMinor: amount.toString() }, 'budget.assign');
  }

  /** P06-06: move planned money between categories in the same month. */
  async moveAssigned(fromId: string, toId: string, month: string, amount: bigint): Promise<Result> {
    if (amount <= 0n || fromId === toId) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    const from = this.assigned(fromId, month, snapshot);
    if (from < amount) return { ok: false, error: 'not_positive' };
    await this.setAssigned(fromId, month, from - amount);
    await this.setAssigned(toId, month, this.assigned(toId, month, snapshot) + amount);
    return { ok: true, value: undefined };
  }

  /** P06-07: raise each overspent category's plan by taking from another category. */
  async coverOverspending(month: string, covers: { overspentId: string; fromId: string; amount: bigint }[]): Promise<Result> {
    for (const cover of covers) {
      if (cover.amount <= 0n) continue;
      const moved = await this.moveAssigned(cover.fromId, cover.overspentId, month, cover.amount);
      if (!moved.ok) return moved;
    }
    return { ok: true, value: undefined };
  }

  async updateCategory(category: Category): Promise<void> {
    const { id, ...data } = category;
    await this.put('categories', id, data, 'category.update');
  }

  async updateSettings(settings: WorkspaceSettings): Promise<void> {
    await this.put('settings', 'workspace', settings, 'settings.update');
  }

  async saveBudgetTemplate(name: string, lines: BudgetTemplate['lines']): Promise<BudgetTemplate> {
    const id = this.newId();
    const template: BudgetTemplate = { id, name: name.trim(), lines };
    const { id: _id, ...data } = template;
    await this.put('budget_templates', id, data, 'budget.template.save');
    return template;
  }

  async applyBudgetTemplate(templateId: string, month: string): Promise<void> {
    const snapshot = await this.load();
    const template = snapshot.budgetTemplates.find((t) => t.id === templateId);
    if (!template) return;
    for (const line of template.lines) {
      await this.setAssigned(line.categoryId, month, BigInt(line.amountMinor));
    }
  }

  /** DESIGN page 6 ⋯ menu — copy planned amounts from another month. */
  async copyBudgetMonth(fromMonth: string, toMonth: string): Promise<void> {
    const snapshot = await this.load();
    for (const cat of snapshot.categories) {
      if (cat.kind !== 'expense') continue;
      const amount = this.assigned(cat.id, fromMonth, snapshot);
      if (amount > 0n) await this.setAssigned(cat.id, toMonth, amount);
    }
  }

  /** DESIGN page 6 — fill planned from recent spending average. */
  async fillBudgetFromAverages(month: string): Promise<void> {
    const { budgetCategories, sixMonthAverage } = await import('@/features/budget/helpers');
    const snapshot = await this.load();
    const cats = budgetCategories(snapshot);
    for (const cat of cats) {
      const avg = sixMonthAverage(snapshot, cat.id, month);
      if (avg > 0n) await this.setAssigned(cat.id, month, avg);
    }
  }

  async clearMonthBudget(month: string): Promise<void> {
    const { budgetCategories } = await import('@/features/budget/helpers');
    const snapshot = await this.load();
    for (const cat of budgetCategories(snapshot)) {
      await this.setAssigned(cat.id, month, 0n);
    }
  }

  async addCategory(input: { name: string; kind: 'income' | 'expense'; group: string }): Promise<Category> {
    const snapshot = await this.load();
    const category: Category = {
      id: this.newId(),
      name: input.name.trim(),
      kind: input.kind,
      group: input.group,
      hidden: false,
      countInBudget: input.kind === 'expense',
      order: snapshot.categories.length,
      budgetType: 'flexible',
      carryOver: false,
    };
    const { id, ...data } = category;
    await this.put('categories', id, data, 'category.create');
    return category;
  }

  async reorderCategory(categoryId: string, direction: 'up' | 'down'): Promise<void> {
    const snapshot = await this.load();
    const kind = snapshot.categories.find((x) => x.id === categoryId)?.kind;
    const sameKind = snapshot.categories.filter((c) => c.kind === kind);
    const index = sameKind.findIndex((c) => c.id === categoryId);
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swap < 0 || swap >= sameKind.length) return;
    const a = sameKind[index]!;
    const b = sameKind[swap]!;
    await this.updateCategory({ ...a, order: b.order ?? swap });
    await this.updateCategory({ ...b, order: a.order ?? index });
  }

  async updatePayee(payee: Payee): Promise<void> {
    const { id, ...data } = payee;
    await this.put('payees', id, data, 'payee.update');
  }

  /** P24-04: move every transaction to the kept payee and remove the others. */
  async mergePayees(keepId: string, mergeIds: string[]): Promise<Result> {
    const ids = mergeIds.filter((id) => id !== keepId);
    if (ids.length === 0) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    const keep = snapshot.payees.find((p) => p.id === keepId);
    if (!keep) return { ok: false, error: 'missing_lines' };
    const merged = ids.map((id) => snapshot.payees.find((p) => p.id === id)).filter(Boolean) as Payee[];
    if (merged.length !== ids.length) return { ok: false, error: 'missing_lines' };

    for (const event of snapshot.events) {
      if (!event.payeeId || !ids.includes(event.payeeId)) continue;
      const rec = await this.store.read('events', event.id);
      if (!rec) continue;
      const data = { ...(rec.data as StoredEvent), payeeId: keepId };
      await this.engine.save({ ...rec, data }, 'event.payee', { collection: 'events', id: event.id, data }, rec.version);
    }

    const aliases = new Set(keep.aliases ?? []);
    for (const p of merged) {
      aliases.add(p.name);
      for (const a of p.aliases ?? []) aliases.add(a);
    }
    await this.updatePayee({ ...keep, aliases: [...aliases] });

    for (const id of ids) {
      const p = merged.find((m) => m.id === id)!;
      await this.put('payees', id, { ...p, deleted: true }, 'payee.delete');
    }
    return { ok: true, value: undefined };
  }

  /**
   * P07-06: move this category's transactions to another, then soft-delete it.
   * Each move is a correction (TECH-SPEC 6.3).
   */
  async deleteCategory(categoryId: string, moveToId: string, _date: string): Promise<Result> {
    if (categoryId === moveToId) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    const category = snapshot.categories.find((c) => c.id === categoryId);
    const target = snapshot.categories.find((c) => c.id === moveToId);
    if (!category || !target || category.kind !== target.kind) return { ok: false, error: 'missing_lines' };

    const accountIds = new Set(snapshot.accounts.map((a) => a.id));
    // Reload after each correction so we never correct an already-reversed event.
    for (;;) {
      const current = await this.load();
      const event = current.events.find(
        (e) =>
          e.status === 'posted' &&
          (e.type === 'expense' || e.type === 'income') &&
          e.lines.some((l) => l.ledgerAccountId === categoryId),
      );
      if (!event) break;
      const money = event.lines.find((l) => accountIds.has(l.ledgerAccountId));
      const part = event.lines.find((l) => l.ledgerAccountId === categoryId);
      if (!money || !part) break;
      const amount = part.amountMinor < 0n ? -part.amountMinor : part.amountMinor;
      if (amount === 0n) break;
      const input: TransactionInput =
        category.kind === 'expense'
          ? {
              kind: 'expense',
              accountId: money.ledgerAccountId,
              parts: event.lines
                .filter((l) => !accountIds.has(l.ledgerAccountId))
                .map((l) => ({
                  categoryId: l.ledgerAccountId === categoryId ? moveToId : l.ledgerAccountId,
                  amount: l.amountMinor < 0n ? -l.amountMinor : l.amountMinor,
                })),
              date: event.date,
              notes: event.notes,
            }
          : {
              kind: 'income',
              accountId: money.ledgerAccountId,
              categoryId: moveToId,
              amount,
              date: event.date,
              notes: event.notes,
            };
      const corrected = await this.correctTransaction(event.id, input);
      if (!corrected.ok) return corrected;
    }

    await this.updateCategory({ ...category, deleted: true, hidden: true });
    return { ok: true, value: undefined };
  }

  async setEventPayee(eventId: string, payeeId: string): Promise<Result> {
    const snapshot = await this.load();
    const event = snapshot.events.find((e) => e.id === eventId);
    if (!event || event.status !== 'posted') return { ok: false, error: 'missing_lines' };
    if (event.reconciledBy) return { ok: false, error: 'reconciled' };
    if (!snapshot.payees.some((p) => p.id === payeeId)) return { ok: false, error: 'missing_lines' };
    const rec = await this.store.read('events', eventId);
    if (!rec) return { ok: false, error: 'missing_lines' };
    const data = { ...(rec.data as StoredEvent), payeeId };
    await this.engine.save({ ...rec, data }, 'event.payee', { collection: 'events', id: eventId, data }, rec.version);
    return { ok: true, value: undefined };
  }

  /** Bulk categorize uses corrections (TECH-SPEC 8). */
  async bulkSetCategory(eventIds: string[], categoryId: string): Promise<Result> {
    for (const id of eventIds) {
      const snapshot = await this.load();
      const event = snapshot.events.find((e) => e.id === id);
      if (!event || event.status !== 'posted' || (event.type !== 'expense' && event.type !== 'income')) continue;
      if (event.reconciledBy) return { ok: false, error: 'reconciled' };
      const accountIds = new Set(snapshot.accounts.map((a) => a.id));
      const money = event.lines.find((l) => accountIds.has(l.ledgerAccountId));
      if (!money) continue;
      const amount = event.lines
        .filter((l) => !accountIds.has(l.ledgerAccountId))
        .reduce((s, l) => s + (l.amountMinor < 0n ? -l.amountMinor : l.amountMinor), 0n);
      const input: TransactionInput =
        event.type === 'expense'
          ? {
              kind: 'expense',
              accountId: money.ledgerAccountId,
              parts: [{ categoryId, amount }],
              date: event.date,
              notes: event.notes,
            }
          : {
              kind: 'income',
              accountId: money.ledgerAccountId,
              categoryId,
              amount,
              date: event.date,
              notes: event.notes,
            };
      const corrected = await this.correctTransaction(id, input);
      if (!corrected.ok) return corrected;
    }
    return { ok: true, value: undefined };
  }

  async bulkDelete(eventIds: string[], date: string): Promise<Result> {
    for (const id of eventIds) {
      const deleted = await this.deleteTransaction(id, date);
      if (!deleted.ok) return deleted;
    }
    return { ok: true, value: undefined };
  }

  async bulkSetPayee(eventIds: string[], payeeId: string): Promise<Result> {
    for (const id of eventIds) {
      const moved = await this.setEventPayee(id, payeeId);
      if (!moved.ok) return moved;
    }
    return { ok: true, value: undefined };
  }

  savedForGoal(goalId: string, snapshot: Snapshot): bigint {
    return snapshot.allocations
      .filter((a) => a.goalId === goalId)
      .reduce((s, a) => {
        const amount = BigInt(a.amountMinor);
        return a.kind === 'spend' ? s - amount : s + amount;
      }, 0n);
  }

  async addGoal(input: { name: string; targetMinor: bigint; accountId: string; targetDate?: string; categoryId?: string }): Promise<Result<Goal>> {
    if (!input.accountId.trim()) return { ok: false, error: 'missing_lines' };
    if (input.targetMinor <= 0n) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    if (!snapshot.accounts.some((a) => a.id === input.accountId && !a.archived)) return { ok: false, error: 'missing_lines' };
    const goal: Goal = {
      id: this.newId(),
      name: input.name.trim(),
      targetMinor: input.targetMinor.toString(),
      accountId: input.accountId,
      targetDate: input.targetDate,
      categoryId: input.categoryId,
      status: 'active',
    };
    const { id, ...data } = goal;
    await this.put('goals', id, data, 'goal.create');
    return { ok: true, value: goal };
  }

  async updateGoal(goal: Goal): Promise<void> {
    const { id, ...data } = goal;
    await this.put('goals', id, data, 'goal.update');
  }

  /** E18: earmark money for a goal; transfer when the source account differs. */
  async allocateToGoal(
    goalId: string,
    input: { amount: bigint; date: string; fromAccountId?: string },
  ): Promise<Result<{ allocation: GoalAllocation; completed: boolean }>> {
    if (input.amount <= 0n) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    const goal = snapshot.goals.find((g) => g.id === goalId);
    if (!goal || goal.status !== 'active') return { ok: false, error: 'missing_lines' };
    const fromId = input.fromAccountId ?? goal.accountId;
    if (!snapshot.accounts.some((a) => a.id === fromId && !a.archived)) return { ok: false, error: 'missing_lines' };
    if (fromId !== goal.accountId) {
      const moved = await this.addTransaction({
        kind: 'transfer',
        fromId,
        toId: goal.accountId,
        amount: input.amount,
        date: input.date,
        notes: t('goals.transferNote', { name: goal.name }),
      });
      if (!moved.ok) return moved;
    }
    const allocation: GoalAllocation = {
      id: this.newId(),
      goalId,
      amountMinor: input.amount.toString(),
      date: input.date,
      fromAccountId: fromId,
    };
    const { id, ...data } = allocation;
    await this.put('allocations', id, data, 'goal.allocate');
    const saved = this.savedForGoal(goalId, await this.load());
    const completed = saved >= BigInt(goal.targetMinor);
    if (completed) {
      await this.updateGoal({ ...goal, status: 'completed' });
    }
    return { ok: true, value: { allocation, completed } };
  }

  debtBalance(debt: PersonDebt, snapshot: Snapshot, onDate?: string): bigint {
    const account = snapshot.chart.get(debt.ledgerAccountId);
    if (!account) return 0n;
    const ledger = ledgerBalance(debt.ledgerAccountId, snapshot.events, onDate);
    return shownBalance(account, ledger);
  }

  async addRecurring(input: Omit<Recurring, 'id'>): Promise<Recurring> {
    const id = this.newId();
    const recurring: Recurring = { ...input, id };
    const { id: _id, ...data } = recurring;
    await this.put('recurring', id, data, 'recurring.create');
    return recurring;
  }

  async updateRecurring(recurring: Recurring): Promise<void> {
    const { id, ...data } = recurring;
    await this.put('recurring', id, data, 'recurring.update');
  }

  /** Link an existing expense to a bill occurrence (DESIGN #26). */
  async matchBillToEvent(recurringId: string, dueDate: string, eventId: string): Promise<Result<RecurringOccurrence>> {
    const snapshot = await this.load();
    const bill = snapshot.recurring.find((r) => r.id === recurringId);
    if (!bill) return { ok: false, error: 'missing_lines' };
    const occId = `${recurringId}:${dueDate}`;
    const existing = snapshot.occurrences.find((o) => o.id === occId);
    if (existing?.status === 'paid') return { ok: false, error: 'already_reversed' };
    const event = snapshot.events.find((e) => e.id === eventId && e.status === 'posted');
    if (!event || event.type !== 'expense') return { ok: false, error: 'missing_lines' };
    const accountIds = new Set(snapshot.accounts.map((a) => a.id));
    const amount = event.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => s + (l.amountMinor < 0n ? -l.amountMinor : l.amountMinor), 0n);
    const occurrence: RecurringOccurrence = {
      id: occId,
      recurringId,
      dueDate,
      amountMinor: amount.toString(),
      status: 'paid',
      eventId,
    };
    await this.put('occurrences', occId, { recurringId, dueDate, amountMinor: amount.toString(), status: 'paid', eventId }, 'occurrence.paid');
    return { ok: true, value: occurrence };
  }

  async markBillPaid(
    recurringId: string,
    dueDate: string,
    input: { accountId: string; categoryId: string; amount: bigint; date: string; payeeId?: string },
  ): Promise<Result<RecurringOccurrence>> {
    const snapshot = await this.load();
    const bill = snapshot.recurring.find((r) => r.id === recurringId);
    if (!bill) return { ok: false, error: 'missing_lines' };
    const occId = `${recurringId}:${dueDate}`;
    const existing = snapshot.occurrences.find((o) => o.id === occId);
    if (existing?.status === 'paid') return { ok: false, error: 'already_reversed' };
    const lines = buildExpense(snapshot.chart, { accountId: input.accountId, parts: [{ categoryId: input.categoryId, amount: input.amount }] });
    if (!lines.ok) return lines;
    const posted = await this.postEvent(snapshot.chart, snapshot.events, {
      type: 'expense',
      date: input.date,
      lines: lines.value,
      payeeId: input.payeeId ?? bill.payeeId,
      recurringId,
    });
    if (!posted.ok) return posted;
    const occurrence: RecurringOccurrence = {
      id: occId,
      recurringId,
      dueDate,
      amountMinor: input.amount.toString(),
      status: 'paid',
      eventId: posted.value.id,
    };
    await this.put('occurrences', occId, { recurringId, dueDate, amountMinor: input.amount.toString(), status: 'paid', eventId: posted.value.id }, 'occurrence.paid');
    return { ok: true, value: occurrence };
  }

  /** Link an existing expense to a bill occurrence (DESIGN popup #26 from page 27). */
  async matchBillToEvent(recurringId: string, dueDate: string, eventId: string): Promise<Result<RecurringOccurrence>> {
    const snapshot = await this.load();
    const bill = snapshot.recurring.find((r) => r.id === recurringId);
    if (!bill) return { ok: false, error: 'missing_lines' };
    const event = snapshot.events.find((e) => e.id === eventId && e.status === 'posted');
    if (!event || event.type !== 'expense') return { ok: false, error: 'missing_lines' };
    const occId = `${recurringId}:${dueDate}`;
    if (snapshot.occurrences.some((o) => o.id === occId && o.status === 'paid')) return { ok: false, error: 'already_reversed' };
    const accountIds = new Set(snapshot.accounts.map((a) => a.id));
    const amountMinor = event.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => s + l.amountMinor, 0n);
    if (amountMinor <= 0n) return { ok: false, error: 'not_positive' };
    const occurrence: RecurringOccurrence = {
      id: occId,
      recurringId,
      dueDate,
      amountMinor: amountMinor.toString(),
      status: 'paid',
      eventId,
    };
    await this.put('occurrences', occId, { recurringId, dueDate, amountMinor: amountMinor.toString(), status: 'paid', eventId }, 'occurrence.matched');
    const billNotificationId = `bill:${occId}`;
    const note = await this.store.read('notifications', billNotificationId);
    if (note) {
      await this.put('notifications', billNotificationId, { ...(note.data as object), read: true }, 'notification.read', note.version);
    }
    return { ok: true, value: occurrence };
  }

  async addIncomeStream(input: Omit<IncomeStream, 'id'>): Promise<IncomeStream> {
    const id = this.newId();
    const stream: IncomeStream = { ...input, id };
    const { id: _id, ...data } = stream;
    await this.put('income_streams', id, data, 'income_stream.create');
    return stream;
  }

  async recordIncomeReceived(
    streamId: string,
    input: { accountId: string; amount: bigint; date: string },
  ): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const stream = snapshot.incomeStreams.find((s) => s.id === streamId);
    if (!stream) return { ok: false, error: 'missing_lines' };
    const lines = buildIncome(snapshot.chart, { accountId: input.accountId, categoryId: stream.categoryId, amount: input.amount });
    if (!lines.ok) return lines;
    return this.postEvent(snapshot.chart, snapshot.events, {
      type: 'income',
      date: input.date,
      lines: lines.value,
      incomeStreamId: streamId,
    });
  }

  async openPersonDebt(input: {
    name: string;
    direction: PersonDebt['direction'];
    accountId: string;
    amount: bigint;
    date: string;
    payeeName?: string;
  }): Promise<Result<PersonDebt>> {
    const snapshot = await this.load();
    const id = this.newId();
    const ledgerAccountId = `${this.workspaceId}:debt:${id}`;
    let payeeId: string | undefined;
    if (input.payeeName?.trim()) {
      payeeId = await this.payeeFor(snapshot.payees, input.payeeName.trim());
    }
    const debt: PersonDebt = {
      id,
      name: input.name.trim() || input.payeeName?.trim() || t('debts.unnamed'),
      direction: input.direction,
      ledgerAccountId,
      payeeId,
      status: 'open',
    };
    const chart = this.chartFor(snapshot.accounts, snapshot.categories, [...snapshot.debts, debt]);
    const lines =
      input.direction === 'owedToMe'
        ? buildLend(chart, { receivableId: ledgerAccountId, accountId: input.accountId, amount: input.amount })
        : buildLoanProceeds(chart, { payableId: ledgerAccountId, accountId: input.accountId, amount: input.amount });
    if (!lines.ok) return lines;
    const posted = await this.postEvent(chart, snapshot.events, {
      type: input.direction === 'owedToMe' ? 'lend' : 'loan_proceeds',
      date: input.date,
      lines: lines.value,
      debtId: id,
      payeeId,
    });
    if (!posted.ok) return posted;
    await this.put('debts', id, { name: debt.name, direction: debt.direction, ledgerAccountId, payeeId, status: 'open' }, 'debt.open');
    const entry: DebtEntry = {
      id: this.newId(),
      debtId: id,
      date: input.date,
      eventId: posted.value.id,
      kind: input.direction === 'owedToMe' ? 'lend' : 'borrow',
      amountMinor: input.amount.toString(),
    };
    await this.put('debt_entries', entry.id, entry, 'debt.entry');
    return { ok: true, value: debt };
  }

  async recordDebtPayment(
    debtId: string,
    input: { accountId: string; amount: bigint; date: string; interest?: bigint },
  ): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const debt = snapshot.debts.find((d) => d.id === debtId);
    if (!debt || debt.status !== 'open') return { ok: false, error: 'missing_lines' };
    const balance = this.debtBalance(debt, snapshot, input.date);
    const principal = input.amount > balance ? balance : input.amount;
    if (principal <= 0n && (input.interest ?? 0n) <= 0n) return { ok: false, error: 'not_positive' };
    const lines =
      debt.direction === 'owedToMe'
        ? buildCollect(snapshot.chart, { receivableId: debt.ledgerAccountId, accountId: input.accountId, principal, interest: input.interest })
        : buildLoanRepayment(snapshot.chart, { payableId: debt.ledgerAccountId, accountId: input.accountId, principal, interest: input.interest });
    if (!lines.ok) return lines;
    const posted = await this.postEvent(snapshot.chart, snapshot.events, {
      type: debt.direction === 'owedToMe' ? 'collect' : 'loan_repayment',
      date: input.date,
      lines: lines.value,
      debtId,
    });
    if (!posted.ok) return posted;
    const entry: DebtEntry = {
      id: this.newId(),
      debtId,
      date: input.date,
      eventId: posted.value.id,
      kind: 'payment',
      amountMinor: principal.toString(),
      interestMinor: input.interest ? input.interest.toString() : undefined,
    };
    await this.put('debt_entries', entry.id, { debtId: entry.debtId, date: entry.date, eventId: entry.eventId, kind: entry.kind, amountMinor: entry.amountMinor, interestMinor: entry.interestMinor }, 'debt.entry');
    const after = await this.load();
    const left = this.debtBalance(debt, after, input.date);
    if (left <= 0n) await this.put('debts', debtId, { name: debt.name, direction: debt.direction, ledgerAccountId: debt.ledgerAccountId, payeeId: debt.payeeId, status: 'settled' }, 'debt.settle');
    return { ok: true, value: posted.value };
  }

  async writeOffDebt(debtId: string, input: { amount: bigint; date: string; reason: string }): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const debt = snapshot.debts.find((d) => d.id === debtId);
    if (!debt || debt.direction !== 'owedToMe' || debt.status !== 'open') return { ok: false, error: 'missing_lines' };
    const balance = this.debtBalance(debt, snapshot, input.date);
    const amount = input.amount > balance ? balance : input.amount;
    if (amount <= 0n) return { ok: false, error: 'not_positive' };
    const lines = buildWriteOff(snapshot.chart, { receivableId: debt.ledgerAccountId, amount });
    if (!lines.ok) return lines;
    const posted = await this.postEvent(snapshot.chart, snapshot.events, {
      type: 'write_off',
      date: input.date,
      lines: lines.value,
      debtId,
      notes: input.reason.trim() || undefined,
    });
    if (!posted.ok) return posted;
    await this.put('debts', debtId, { ...debt, status: 'settled' }, 'debt.write_off');
    return { ok: true, value: posted.value };
  }

  async refreshBillNotifications(): Promise<void> {
    const snapshot = await this.load();
    const today = workspaceToday();
    const month = monthOf(today);
    const existing = new Map(snapshot.notifications.map((n) => [n.id, n]));
    for (const bill of snapshot.recurring) {
      if (bill.kind === 'income') continue;
      const dueDate = billDueInMonth(bill.rule, month);
      if (!dueDate || dueDate < bill.startDate) continue;
      const occId = `${bill.id}:${dueDate}`;
      const paid = snapshot.occurrences.some((o) => o.id === occId && o.status === 'paid');
      if (paid) continue;
      const id = `bill:${occId}`;
      if (existing.has(id)) continue;
      const overdue = dueDate < today;
      const notification: AppNotification = {
        id,
        createdAt: new Date().toISOString(),
        title: overdue
          ? t('notifications.billMissed', { name: bill.name, dueDate: formatDay(dueDate) })
          : t('notifications.billDue', { name: bill.name }),
        category: 'bills',
        read: false,
        action: overdue ? 'match' : 'mark_paid',
        recurringId: bill.id,
        dueDate,
        amountMinor: bill.amountMinor,
        hideAmount: true,
      };
      const { id: nid, ...data } = notification;
      await this.put('notifications', id, data, 'notification.create');
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    const rec = await this.store.read('notifications', id);
    if (!rec) return;
    await this.put('notifications', id, { ...(rec.data as object), read: true }, 'notification.read', rec.version);
  }

  async markAllNotificationsRead(): Promise<void> {
    const rows = await this.store.list('notifications');
    for (const r of rows) {
      if ((r.data as AppNotification).read) continue;
      await this.put('notifications', r.id, { ...(r.data as object), read: true }, 'notification.read', r.version);
    }
  }

  async snoozeNotification(id: string, until: string): Promise<void> {
    const rec = await this.store.read('notifications', id);
    if (!rec) return;
    await this.put('notifications', id, { ...(rec.data as object), snoozedUntil: until, read: true }, 'notification.snooze', rec.version);
  }

  async updateIncomeStream(stream: IncomeStream): Promise<void> {
    const { id, ...data } = stream;
    await this.put('income_streams', id, data, 'income_stream.update');
  }

  async linkEventToStream(eventId: string, streamId: string): Promise<void> {
    const rec = await this.store.read('events', eventId);
    if (!rec) return;
    const data = { ...(rec.data as StoredEvent), incomeStreamId: streamId, oneOff: undefined };
    await this.engine.save({ ...rec, data }, 'event.link_stream', { collection: 'events', id: eventId, data }, rec.version);
  }

  async markIncomeOneOff(eventId: string): Promise<void> {
    const rec = await this.store.read('events', eventId);
    if (!rec) return;
    const data = { ...(rec.data as StoredEvent), incomeStreamId: undefined, oneOff: true };
    await this.engine.save({ ...rec, data }, 'event.one_off', { collection: 'events', id: eventId, data }, rec.version);
  }

  /** E19: expense linked to a goal; lowers earmarked savings without budget overspend messaging in UI. */
  async spendFromGoal(
    goalId: string,
    input: { accountId: string; categoryId: string; amount: bigint; date: string; payeeName?: string },
  ): Promise<Result<{ event: TxEvent; allocation: GoalAllocation }>> {
    const snapshot = await this.load();
    const goal = snapshot.goals.find((g) => g.id === goalId);
    if (!goal || goal.status !== 'active') return { ok: false, error: 'missing_lines' };
    const saved = this.savedForGoal(goalId, snapshot);
    if (input.amount > saved) return { ok: false, error: 'refund_too_large' };
    const lines = buildExpense(snapshot.chart, { accountId: input.accountId, parts: [{ categoryId: input.categoryId, amount: input.amount }] });
    if (!lines.ok) return lines;
    const payeeId = input.payeeName?.trim() ? await this.payeeFor(snapshot.payees, input.payeeName.trim(), input.categoryId) : undefined;
    const posted = await this.postEvent(snapshot.chart, snapshot.events, {
      type: 'expense',
      date: input.date,
      lines: lines.value,
      payeeId,
      goalId,
    });
    if (!posted.ok) return posted;
    const allocation: GoalAllocation = {
      id: this.newId(),
      goalId,
      amountMinor: input.amount.toString(),
      date: input.date,
      fromAccountId: input.accountId,
      kind: 'spend',
    };
    const { id, ...data } = allocation;
    await this.put('allocations', id, data, 'goal.spend');
    return { ok: true, value: { event: posted.value, allocation } };
  }

  private linesFor(chart: Chart, input: TransactionInput): Result<{ lines: Line[]; splitTotal?: bigint }> {
    if (input.kind === 'expense') {
      const r = buildExpense(chart, { accountId: input.accountId, parts: input.parts });
      if (!r.ok) return r;
      return { ok: true, value: { lines: r.value, splitTotal: input.parts.length > 1 ? input.parts.reduce((s, p) => s + p.amount, 0n) : undefined } };
    }
    const r =
      input.kind === 'income'
        ? buildIncome(chart, { accountId: input.accountId, categoryId: input.categoryId, amount: input.amount })
        : buildTransfer(chart, { fromId: input.fromId, toId: input.toId, amount: input.amount });
    return r.ok ? { ok: true, value: { lines: r.value } } : r;
  }

  private async payeeFor(payees: Payee[], name: string, categoryId?: string): Promise<string> {
    const key = name.toLowerCase();
    const existing =
      payees.find((p) => p.name.toLowerCase() === key) ??
      payees.find((p) => (p.aliases ?? []).some((a) => a.toLowerCase() === key));
    if (existing) return existing.id;
    const id = this.newId();
    await this.put('payees', id, { name, defaultCategoryId: categoryId }, 'payee.create');
    return id;
  }

  private async postEvent(
    chart: Chart,
    events: TxEvent[],
    input: Omit<MoneyEvent, 'id' | 'operationId' | 'status' | 'lines'> & { lines: Line[] } & EventMeta,
  ): Promise<Result<TxEvent>> {
    const id = this.newId();
    const event: TxEvent = { ...input, id, operationId: id, status: 'posted' };
    const checked = checkEvent(chart, event, new Map(events.map((e) => [e.id, e])));
    if (!checked.ok) return checked;
    await this.put('events', id, { ...toStored(input), operationId: id }, `event.${input.type}`);
    return { ok: true, value: event };
  }
}
