import { v7 as uuidv7 } from 'uuid';

import type { SetupBody } from '@/api/auth';
import { formatDay } from '@/design/components/overlays';
import { budgetForMonth, resolveTemplateLineAmount, rowFor } from '@/features/budget/helpers';
import { ruleChangeFor } from '@/features/rules/ruleEngine';
import type { RemoteOperation } from '../sync/mapOperation';
import { goalBody, goalUpdateBody, incomeStreamBody, incomeStreamUpdateBody, scheduleBody, scheduleUpdateBody } from '../sync/serverRecords';
import { t, type TextKey } from '@/i18n';
import {
  buildAdjustment,
  buildCollect,
  buildExpense,
  buildIncome,
  buildInvestmentBuy,
  buildInvestmentSell,
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
  costOfPurchase,
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
  type BudgetAssign,
  type BudgetType,
  DEFAULT_NOTIFICATION_PREFS,
  type Category,
  type EventMeta,
  type ImportMapping,
  type Goal,
  type GoalAllocation,
  type AppNotification,
  type NotificationCategory,
  type PersonDebt,
  type DebtEntry,
  type Recurring,
  type RecurringOccurrence,
  type RecurrenceRule,
  type IncomeStream,
  type Payee,
  type Reconcile,
  type RuleAction,
  type RuleStage,
  type StoredEvent,
  type TransactionRule,
  type WorkspaceSettings,
  type Holding,
  type HoldingLot,
  type HoldingPrice,
  type HoldingType,
  type HealthSettings,
  type ReportDashboard,
  type SavedReport,
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
  /** categoryId:month → optional plan note (DESIGN #7). */
  assignNotes: Map<string, string>;
  goals: Goal[];
  allocations: GoalAllocation[];
  recurring: Recurring[];
  occurrences: RecurringOccurrence[];
  incomeStreams: IncomeStream[];
  debts: PersonDebt[];
  debtEntries: DebtEntry[];
  notifications: AppNotification[];
  budgetTemplates: BudgetTemplate[];
  rules: TransactionRule[];
  holdings: Holding[];
  lots: HoldingLot[];
  prices: HoldingPrice[];
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

const STAGE_RANK: Record<RuleStage, number> = { first: 0, normal: 1, last: 2 };

function stageOrder(stage: RuleStage): number {
  return STAGE_RANK[stage];
}

export type TransactionInput =
  | { kind: 'expense'; accountId: string; parts: ExpensePart[]; date: string; payeeName?: string; notes?: string }
  | { kind: 'income'; accountId: string; categoryId: string; amount: bigint; date: string; payeeName?: string; notes?: string }
  | { kind: 'transfer'; fromId: string; toId: string; amount: bigint; date: string; notes?: string; toAmount?: bigint };

/**
 * Writes the server derives from another operation, or keeps per device for now: they're saved locally and never
 * sent. Debt history and settling follow the debt's own operations; occurrences follow the matched transaction.
 */
const LOCAL_ONLY = new Set([
  'debt.entry',
  'debt.settle',
  'debt.update',
  'occurrence.paid',
  'occurrence.matched',
  'occurrence.unpaid',
  'reconcile.finish',
  'transfer.dismiss',
  'settings.update',
  'budget.template.save',
  'payee.delete',
  'notification.create',
  'notification.read',
  'notification.snooze',
  'holding.create',
  'holding.update',
  'holding.delete',
  'lot.create',
  'lot.update',
  'price.upsert',
]);

const todayInLagos = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

const record = (collection: string, id: string, data: object, version = 0): LocalRecord => ({
  id,
  collection,
  version,
  data: data as Record<string, unknown>,
});

type CategoryDeleteUndo = {
  categoryId: string;
  moveToId: string;
  category: Category;
  replacementEventIds: string[];
  planMoves: { month: string; amount: bigint; note: string }[];
};

/** Reads and writes the workspace through the local store; every write is queued for sync. */
export class WorkspaceRepository {
  private readonly categoryDeleteUndos = new Map<string, CategoryDeleteUndo>();

  constructor(
    private readonly store: LocalStore,
    private readonly engine: SyncEngine,
    readonly workspaceId: string,
    private readonly newId: () => string = uuidv7,
  ) {}

  /** Sentinel for envelope "Left to plan" when covering overspending (PU-10). */
  static readonly LEFT_TO_PLAN = '__left_to_plan__';

  async load(): Promise<Snapshot> {
    const [accounts, categories, payees, events, outbox, reconciles, settingsRows, assignRows, goalRows, allocationRows, recurringRows, occurrenceRows, streamRows, debtRows, debtEntryRows, notificationRows, templateRows, ruleRows, holdingRows, lotRows, priceRows] =
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
      this.store.list('rules'),
      this.store.list('holdings'),
      this.store.list('lots'),
      this.store.list('prices'),
    ]);
    const reversedIds = new Set(events.map((e) => (e.data as StoredEvent).reversalOf).filter(Boolean));
    const accountList = accounts.map((r) => ({ ...(r.data as Omit<Account, 'id'>), id: r.id })).sort((a, b) => a.order - b.order);
    // Categories from the server name their group by id; show the group's name.
    const groupNames = new Map((await this.store.list('category_groups')).map((g) => [g.id, String(g.data.name ?? '')]));
    const categoryList = categories
      .map((r) => {
        const data = r.data as Omit<Category, 'id'>;
        return {
          ...data,
          group: groupNames.get(data.group) ?? data.group,
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
      profilePhotoUri: raw?.profilePhotoUri,
      hapticsEnabled: raw?.hapticsEnabled,
      tags: raw?.tags,
      dueSoonDays: raw?.dueSoonDays === 3 || raw?.dueSoonDays === 7 || raw?.dueSoonDays === 14 || raw?.dueSoonDays === 30 ? raw.dueSoonDays : undefined,
      health: raw?.health,
      reportDashboards: raw?.reportDashboards,
      savedReports: raw?.savedReports,
    };
    const holdings = holdingRows.map((r) => ({ ...(r.data as Omit<Holding, 'id'>), id: r.id }));
    const lots = lotRows.map((r) => ({ ...(r.data as Omit<HoldingLot, 'id'>), id: r.id }));
    const prices = priceRows.map((r) => ({ ...(r.data as Omit<HoldingPrice, 'id'>), id: r.id }));
    const debts = debtRows.map((r) => ({ ...(r.data as Omit<PersonDebt, 'id'>), id: r.id }));
    const assigns = new Map<string, bigint>();
    const assignNotes = new Map<string, string>();
    for (const r of assignRows) {
      const d = r.data as BudgetAssign;
      assigns.set(budgetAssignId(d.categoryId, d.month), BigInt(d.amountMinor));
      if (d.note?.trim()) assignNotes.set(budgetAssignId(d.categoryId, d.month), d.note.trim());
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
      reconciles: reconciles
        .map((r) => {
          const data = r.data as Omit<Reconcile, 'id'>;
          return { ...data, finishedBy: data.finishedBy ?? null, id: r.id };
        })
        .sort((a, b) => b.statementDate.localeCompare(a.statementDate)),
      assigns,
      assignNotes,
      goals: goalRows
        .map((r) => ({ ...(r.data as Omit<Goal, 'id'> & { deleted?: boolean }), id: r.id }))
        .filter((g) => !g.deleted),
      allocations: allocationRows
        .map((r) => ({ ...(r.data as Omit<GoalAllocation, 'id'> & { deleted?: boolean }), id: r.id }))
        .filter((a) => !a.deleted),
      recurring: recurringRows.map((r) => ({ ...(r.data as Omit<Recurring, 'id'>), id: r.id })),
      occurrences: occurrenceRows.map((r) => ({ ...(r.data as Omit<RecurringOccurrence, 'id'>), id: r.id })),
      incomeStreams: streamRows.map((r) => ({ ...(r.data as Omit<IncomeStream, 'id'>), id: r.id })),
      debts,
      debtEntries: debtEntryRows.map((r) => ({ ...(r.data as Omit<DebtEntry, 'id'>), id: r.id })),
      notifications: notificationRows
        .map((r) => ({ ...(r.data as Omit<AppNotification, 'id'>), id: r.id }))
        .filter((n) => !n.snoozedUntil || n.snoozedUntil <= workspaceToday()),
      budgetTemplates: templateRows.map((r) => ({ ...(r.data as Omit<BudgetTemplate, 'id'>), id: r.id })),
      rules: ruleRows
        .map((r) => {
          const d = r.data as Omit<TransactionRule, 'id'> & { deleted?: boolean };
          if (d.deleted) return null;
          return {
            ...d,
            id: r.id,
            matchedCount: d.matchedCount ?? 0,
            order: d.order ?? 0,
            matchMode: d.matchMode ?? 'all',
            conditions: d.conditions ?? [],
            actions: d.actions ?? [],
            enabled: d.enabled ?? true,
            stage: d.stage ?? 'normal',
          } satisfies TransactionRule;
        })
        .filter((r): r is TransactionRule => r !== null)
        .sort((a, b) => (a.stage === b.stage ? a.order - b.order : stageOrder(a.stage) - stageOrder(b.stage))),
      holdings,
      lots,
      prices,
      waiting,
      chart: this.chartFor(accountList, categoryList, debts, holdings),
    };
  }

  chartFor(accounts: Account[], categories: Category[], debts: PersonDebt[] = [], holdings: Holding[] = []): Chart {
    const ledger: LedgerAccount[] = [
      ...accounts.map((a) => ({ id: a.id, kind: ACCOUNT_KIND_INFO[a.type].ledger, name: a.name, currency: a.currency })),
      ...categories.map((c) => ({ id: c.id, kind: c.kind, name: c.name, currency: 'NGN', categoryId: c.id, countInBudget: c.countInBudget })),
      ...debts.map((d) => ({
        id: d.ledgerAccountId,
        kind: d.direction === 'owedToMe' ? ('asset' as const) : ('liability' as const),
        name: d.name,
        currency: 'NGN',
      })),
      ...holdings.map((h) => ({
        id: h.ledgerAccountId,
        kind: 'asset' as const,
        name: h.name,
        currency: h.currency,
      })),
      ...systemAccounts(this.workspaceId),
    ];
    return new Chart(ledger);
  }

  /**
   * Saves locally and queues the write. `remote` is the API operation the write stands for when the local shape
   * can't be mapped on its own (see RemoteOperation); null keeps the write on this device.
   */
  private async put(collection: string, id: string, data: object, type: string, baseVersion?: number, remote?: RemoteOperation | null) {
    const kept = remote === undefined && LOCAL_ONLY.has(type) ? null : remote;
    const payload = kept === undefined ? { collection, id, data } : { collection, id, data, remote: kept };
    await this.engine.save(record(collection, id, data, baseVersion ?? 0), type, payload, baseVersion);
  }

  /** The record's version as the server last sent it, for an update's baseVersion. */
  private async versionOf(collection: string, id: string): Promise<number> {
    return (await this.store.read(collection, id))?.version ?? 1;
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
    currency?: string;
    countInBudget?: boolean;
    openingBalance: bigint;
    openingDate: string;
  }): Promise<Result<Account>> {
    const snapshot = await this.load();
    const account: Account = {
      id: this.newId(),
      name: input.name,
      type: input.type,
      currency: input.currency ?? 'NGN',
      institution: input.institution,
      last4: input.last4?.slice(-4),
      countInBudget: input.countInBudget ?? ACCOUNT_KIND_INFO[input.type].countInBudget,
      archived: false,
      openedAt: input.openingDate,
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
    // Rules rename the payee and add notes as the transaction is saved (P25-05); the category was already offered.
    const amount = input.kind === 'expense' ? input.parts.reduce((s, p) => s + p.amount, 0n) : input.amount;
    const fromRules =
      input.kind === 'transfer'
        ? {}
        : ruleChangeFor(snapshot.rules, {
            payeeName: input.payeeName?.trim() ?? '',
            description: input.payeeName?.trim() ?? '',
            amountMinor: amount,
            accountId: input.accountId,
            categoryId: input.kind === 'expense' ? (input.parts[0]?.categoryId ?? '') : input.categoryId,
            notes: input.notes ?? '',
            date: input.date,
          });
    const payeeName = input.kind === 'transfer' ? undefined : (fromRules.payeeName ?? input.payeeName?.trim());
    const notes = [input.notes?.trim(), fromRules.notes].filter(Boolean).join('. ') || undefined;
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
      notes,
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

  /** P11-09: reverse opposite legs and post one transfer (mirrors BE linkTransfer). */
  async linkAsTransfer(outId: string, inId: string): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const out = snapshot.events.find((e) => e.id === outId);
    const inn = snapshot.events.find((e) => e.id === inId);
    if (!out || !inn) return { ok: false, error: 'missing_lines' };
    if (out.reconciledBy || inn.reconciledBy) return { ok: false, error: 'reconciled' };
    const accounts = new Map(snapshot.accounts.map((a) => [a.id, a]));
    const outReal = out.lines.filter((l) => accounts.has(l.ledgerAccountId));
    const inReal = inn.lines.filter((l) => accounts.has(l.ledgerAccountId));
    if (outReal.length !== 1 || inReal.length !== 1) return { ok: false, error: 'missing_lines' };
    const fromId = outReal[0]!.ledgerAccountId;
    const toId = inReal[0]!.ledgerAccountId;
    if (fromId === toId) return { ok: false, error: 'missing_lines' };
    const fromAccount = accounts.get(fromId)!;
    const outShown =
      ACCOUNT_KIND_INFO[fromAccount.type].ledger === 'liability' ? -outReal[0]!.amountMinor : outReal[0]!.amountMinor;
    const amount = outShown < 0n ? -outShown : outShown;
    if (amount <= 0n) return { ok: false, error: 'not_positive' };
    const date = out.date;
    const notes = out.notes ?? inn.notes;
    const payeeId = out.payeeId ?? inn.payeeId;
    const reversedOut = await this.deleteTransaction(outId, date);
    if (!reversedOut.ok) return reversedOut;
    const reversedIn = await this.deleteTransaction(inId, date);
    if (!reversedIn.ok) return reversedIn;
    const after = await this.load();
    const lines = buildTransfer(after.chart, { fromId, toId, amount });
    if (!lines.ok) return lines;
    return this.postEvent(after.chart, after.events, {
      type: 'transfer',
      date,
      lines: lines.value,
      notes,
      payeeId,
    });
  }

  async transferDismissals(): Promise<Set<string>> {
    const rows = await this.store.list('transfer_dismissals');
    return new Set(rows.map((r) => r.id));
  }

  async dismissTransferMatch(outId: string, inId: string): Promise<void> {
    const id = `${outId}:${inId}`;
    await this.put('transfer_dismissals', id, { outId, inId }, 'transfer.dismiss');
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

  /** E10: a new value for property or an untracked investment; the change goes to Revaluation, never income (P08-05 / PU-14). */
  async updateValue(accountId: string, value: bigint, date: string, notes?: string): Promise<Result<TxEvent | null>> {
    const snapshot = await this.load();
    const account = snapshot.chart.get(accountId);
    if (!account) return { ok: false, error: 'missing_lines' };
    const current = ledgerBalance(accountId, snapshot.events);
    const target = account.kind === 'liability' ? -value : value;
    if (target === current) return { ok: true, value: null };
    const lines = buildAdjustment(snapshot.chart, { accountId, delta: target - current, against: 'revaluation' });
    if (!lines.ok) return lines;
    return this.postEvent(snapshot.chart, snapshot.events, {
      type: 'balance_adjustment',
      date,
      lines: lines.value,
      notes: notes?.trim() || undefined,
    });
  }

  /**
   * PU-15 / P08-06: archive an account.
   * - Zero balance: archive.
   * - `moveToId` set: transfer the balance first, then archive.
   * - `moveToId === null`: archive with its balance (still counts in net worth).
   * - Balance and `moveToId` omitted: refused — the person must choose.
   */
  async archiveAccount(accountId: string, date: string, moveToId?: string | null): Promise<Result> {
    const snapshot = await this.load();
    const account = snapshot.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'missing_lines' };
    const balance = ledgerBalance(accountId, snapshot.events);
    if (balance !== 0n) {
      if (moveToId === undefined) return { ok: false, error: 'missing_lines' };
      if (moveToId !== null) {
        const amount = balance > 0n ? balance : -balance;
        const lines =
          balance > 0n
            ? buildTransfer(snapshot.chart, { fromId: accountId, toId: moveToId, amount })
            : buildTransfer(snapshot.chart, { fromId: moveToId, toId: accountId, amount });
        if (!lines.ok) return lines;
        const posted = await this.postEvent(snapshot.chart, snapshot.events, { type: 'transfer', date, lines: lines.value });
        if (!posted.ok) return posted;
        await this.updateAccount({ ...account, archived: true, closedWithBalance: false });
        return { ok: true, value: undefined };
      }
      await this.updateAccount({ ...account, archived: true, closedWithBalance: true });
      return { ok: true, value: undefined };
    }
    await this.updateAccount({ ...account, archived: true, closedWithBalance: false });
    return { ok: true, value: undefined };
  }

  /** Undo of archive (PU-15 toast Undo). */
  async restoreAccount(accountId: string): Promise<Result> {
    const snapshot = await this.load();
    const account = snapshot.accounts.find((a) => a.id === accountId);
    if (!account) return { ok: false, error: 'missing_lines' };
    await this.updateAccount({ ...account, archived: false, closedWithBalance: false });
    return { ok: true, value: undefined };
  }

  /** Details tab: forget the remembered CSV column mapping (TB-03). */
  async clearImportMapping(accountId: string): Promise<void> {
    const snapshot = await this.load();
    const account = snapshot.accounts.find((a) => a.id === accountId);
    if (!account?.importMapping) return;
    const next: Account = { ...account };
    delete next.importMapping;
    await this.updateAccount(next);
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
    /** Current user id for Details history “who” (TB03-3). */
    finishedBy?: string | null;
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
      finishedBy: input.finishedBy ?? null,
    };
    const { id, ...data } = reconcile;
    await this.put('reconciles', id, data, 'reconcile.finish');
    return { ok: true, value: reconcile };
  }

  assigned(categoryId: string, month: string, snapshot: Snapshot): bigint {
    return snapshot.assigns.get(budgetAssignId(categoryId, month)) ?? 0n;
  }

  async setAssigned(categoryId: string, month: string, amount: bigint, opts?: { note?: string }): Promise<void> {
    const id = budgetAssignId(categoryId, month);
    const snapshot = await this.load();
    const note =
      opts?.note !== undefined
        ? opts.note.trim() || undefined
        : snapshot.assignNotes.get(id);
    const payload: BudgetAssign = {
      categoryId,
      month,
      amountMinor: amount.toString(),
      ...(note ? { note } : {}),
    };
    await this.put('budget_assigns', id, payload, 'budget.assign', undefined, {
      type: 'budget.assign',
      targetId: categoryId,
      payload: { month, assigned: payload.amountMinor },
    });
  }

  /** P06-06 / PU-08: move available money between categories in the same month. */
  async moveAssigned(fromId: string, toId: string, month: string, amount: bigint): Promise<Result> {
    if (amount <= 0n || fromId === toId) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    const available = rowFor(snapshot, month, fromId).available;
    if (available < amount) return { ok: false, error: 'not_positive' };
    const from = this.assigned(fromId, month, snapshot);
    await this.setAssigned(fromId, month, from - amount);
    await this.setAssigned(toId, month, this.assigned(toId, month, snapshot) + amount);
    return { ok: true, value: undefined };
  }

  /** P06-07 / PU-10: raise each overspent category's plan by taking from another category (or left to plan). */
  async coverOverspending(month: string, covers: { overspentId: string; fromId: string; amount: bigint }[]): Promise<Result> {
    for (const cover of covers) {
      if (cover.amount <= 0n) continue;
      if (cover.fromId === WorkspaceRepository.LEFT_TO_PLAN) {
        const snapshot = await this.load();
        if (budgetForMonth(snapshot, month).leftToPlan < cover.amount) return { ok: false, error: 'not_positive' };
        await this.setAssigned(cover.overspentId, month, this.assigned(cover.overspentId, month, snapshot) + cover.amount);
        continue;
      }
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
    const snapshot = await this.load();
    const existing = snapshot.budgetTemplates.find((t) => t.name === name.trim());
    const id = existing?.id ?? this.newId();
    const template: BudgetTemplate = { id, name: name.trim(), lines };
    const { id: _id, ...data } = template;
    const version = existing ? await this.versionOf('budget_templates', id) : undefined;
    await this.put('budget_templates', id, data, 'budget.template.save', version);
    return template;
  }

  /**
   * Apply a template's fills for the month (PU-09).
   * Categories the person already planned are kept unless `replace` is true.
   */
  async applyBudgetTemplate(templateId: string, month: string, opts?: { replace?: boolean }): Promise<void> {
    const snapshot = await this.load();
    const template = snapshot.budgetTemplates.find((t) => t.id === templateId);
    if (!template) return;
    for (const line of template.lines) {
      const existing = this.assigned(line.categoryId, month, snapshot);
      if (!opts?.replace && existing > 0n) continue;
      const amount = resolveTemplateLineAmount(snapshot, month, line);
      if (amount > 0n) await this.setAssigned(line.categoryId, month, amount);
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

  async addCategory(input: {
    name: string;
    kind: 'income' | 'expense';
    group: string;
    icon?: string | null;
    budgetType?: BudgetType;
    essential?: boolean;
    hidden?: boolean;
    carryOver?: boolean;
  }): Promise<Category> {
    const snapshot = await this.load();
    const category: Category = {
      id: this.newId(),
      name: input.name.trim(),
      kind: input.kind,
      group: input.group,
      icon: input.icon ?? null,
      hidden: input.hidden ?? false,
      countInBudget: input.kind === 'expense',
      order: snapshot.categories.length,
      budgetType: input.budgetType ?? 'flexible',
      carryOver: input.carryOver ?? snapshot.settings.carryOverDefault ?? false,
      essential: input.essential ?? false,
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

  async updatePayee(payee: Payee): Promise<Result> {
    const snapshot = await this.load();
    const aliases = payee.aliases ?? [];
    for (const alias of aliases) {
      const key = alias.trim().toLowerCase();
      if (!key) continue;
      const owner = snapshot.payees.find((p) => {
        if (p.id === payee.id) return false;
        if (p.name.toLowerCase() === key) return true;
        return (p.aliases ?? []).some((a) => a.toLowerCase() === key);
      });
      if (owner) return { ok: false, error: 'missing_lines' };
    }
    const { id, ...data } = payee;
    await this.put('payees', id, data, 'payee.update');
    return { ok: true, value: undefined };
  }

  /** Soft-delete only when the payee has no transactions (PU-46). */
  async deletePayee(payeeId: string): Promise<Result> {
    const snapshot = await this.load();
    const payee = snapshot.payees.find((p) => p.id === payeeId);
    if (!payee) return { ok: false, error: 'missing_lines' };
    if (snapshot.events.some((e) => e.payeeId === payeeId && e.status === 'posted')) {
      return { ok: false, error: 'missing_lines' };
    }
    await this.put('payees', payeeId, { ...payee, deleted: true }, 'payee.delete');
    return { ok: true, value: undefined };
  }

  /**
   * P24-04 / PU-47: move every transaction and bank name to the kept payee.
   * Returns mergeId so Undo can restore (TECH-SPEC merge undo).
   */
  async mergePayees(
    keepId: string,
    mergeIds: string[],
    choices?: { nameId?: string; logoId?: string; categoryId?: string },
  ): Promise<Result<{ mergeId: string; moved: number }>> {
    const ids = mergeIds.filter((id) => id !== keepId);
    if (ids.length === 0) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    const all = snapshot.payees;
    const byId = (id: string) => all.find((p) => p.id === id);
    const keepPayee = byId(keepId);
    if (!keepPayee) return { ok: false, error: 'missing_lines' };
    const merged = ids.map((id) => byId(id)).filter(Boolean) as Payee[];
    if (merged.length !== ids.length) return { ok: false, error: 'missing_lines' };

    const moved: { eventId: string; fromPayeeId: string }[] = [];
    for (const event of snapshot.events) {
      if (!event.payeeId || !ids.includes(event.payeeId)) continue;
      const rec = await this.store.read('events', event.id);
      if (!rec) continue;
      moved.push({ eventId: event.id, fromPayeeId: event.payeeId });
      const data = { ...(rec.data as StoredEvent), payeeId: keepId };
      await this.engine.save({ ...rec, data }, 'event.payee', { collection: 'events', id: event.id, data }, rec.version);
    }

    const nameSrc = byId(choices?.nameId ?? keepId) ?? keepPayee;
    const logoSrc = byId(choices?.logoId ?? keepId) ?? keepPayee;
    const catSrc = byId(choices?.categoryId ?? keepId) ?? keepPayee;
    const next: Payee = {
      ...keepPayee,
      // Name stays on keepId (radio chooses which payee id is kept); logo/category may come from a sibling.
      name: keepPayee.name,
      logoUri: logoSrc.logoUri,
      defaultCategoryId: catSrc.defaultCategoryId,
    };
    // If the user chose another payee's name, rename the kept record to that name.
    if (choices?.nameId && choices.nameId !== keepId && nameSrc) {
      next.name = nameSrc.name;
    }
    const aliases = new Set(next.aliases ?? []);
    for (const p of merged) {
      aliases.add(p.name);
      for (const a of p.aliases ?? []) aliases.add(a);
    }
    // Drop the kept display name from aliases if it was a sibling's name we promoted.
    aliases.delete(next.name);
    next.aliases = [...aliases];
    const { id: _keepId, ...keepBody } = next;
    await this.put('payees', next.id, keepBody, 'payee.update');

    for (const id of ids) {
      const p = merged.find((m) => m.id === id)!;
      await this.put('payees', id, { ...p, deleted: true }, 'payee.delete');
    }

    const mergeId = this.newId();
    await this.put(
      'payee_merges',
      mergeId,
      {
        keepId,
        previousKeep: keepPayee,
        removed: merged,
        moved,
      },
      'payee.merge',
      undefined,
      null,
    );
    return { ok: true, value: { mergeId, moved: moved.length } };
  }

  /** PU47-2: restore payees and transaction links exactly as before the merge. */
  async undoMergePayees(mergeId: string): Promise<Result> {
    const rec = await this.store.read('payee_merges', mergeId);
    if (!rec) return { ok: false, error: 'missing_lines' };
    const data = rec.data as {
      keepId: string;
      previousKeep: Payee;
      removed: Payee[];
      moved: { eventId: string; fromPayeeId: string }[];
    };

    for (const row of data.moved) {
      const eventRec = await this.store.read('events', row.eventId);
      if (!eventRec) continue;
      const eventData = { ...(eventRec.data as StoredEvent), payeeId: row.fromPayeeId };
      await this.engine.save(
        { ...eventRec, data: eventData },
        'event.payee',
        { collection: 'events', id: row.eventId, data: eventData },
        eventRec.version,
      );
    }

    const { id: keepId, ...keepBody } = data.previousKeep;
    await this.put('payees', keepId, keepBody, 'payee.update');
    for (const p of data.removed) {
      const { id, deleted: _d, ...body } = p as Payee & { deleted?: boolean };
      await this.put('payees', id, body, 'payee.update');
    }
    await this.put('payee_merges', mergeId, { ...data, undone: true }, 'payee.merge.undo', undefined, null);
    return { ok: true, value: undefined };
  }

  async saveRule(rule: TransactionRule): Promise<void> {
    const { id, ...data } = rule;
    const { deleted: _d, ...body } = data as typeof data & { deleted?: boolean };
    await this.put('rules', id, data, 'rule.update', undefined, { type: 'rule.upsert', targetId: id, payload: body });
  }

  async createRule(
    input: Omit<TransactionRule, 'id' | 'matchedCount' | 'order'> & { order?: number },
  ): Promise<TransactionRule> {
    const snapshot = await this.load();
    const stageRules = snapshot.rules.filter((r) => r.stage === input.stage);
    const rule: TransactionRule = {
      ...input,
      id: this.newId(),
      matchedCount: 0,
      order: input.order ?? stageRules.length,
    };
    await this.saveRule(rule);
    return rule;
  }

  async deleteRule(ruleId: string): Promise<void> {
    const snapshot = await this.load();
    const rule = snapshot.rules.find((r) => r.id === ruleId);
    if (!rule) return;
    await this.put('rules', ruleId, { ...rule, deleted: true, enabled: false }, 'rule.delete', undefined, { type: 'rule.delete', targetId: ruleId, payload: {} });
  }

  async reorderRules(ruleId: string, direction: 'up' | 'down'): Promise<void> {
    const snapshot = await this.load();
    const rule = snapshot.rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const sameStage = snapshot.rules.filter((r) => r.stage === rule.stage).sort((a, b) => a.order - b.order);
    const index = sameStage.findIndex((r) => r.id === ruleId);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const other = sameStage[swapIndex];
    if (!other) return;
    await this.saveRule({ ...rule, order: other.order });
    await this.saveRule({ ...other, order: rule.order });
  }

  async runRule(ruleId: string, range: { from?: string; to?: string }): Promise<Result<{ changed: number }>> {
    const snapshot = await this.load();
    const rule = snapshot.rules.find((r) => r.id === ruleId);
    if (!rule || !rule.enabled) return { ok: false, error: 'missing_lines' };
    const { previewMatches } = await import('@/features/rules/ruleEngine');
    const matches = previewMatches(snapshot, rule, range.from, range.to);
    let changed = 0;
    for (const ctx of matches) {
      const applied = await this.applyRuleActions(ctx.eventId, rule.actions);
      if (applied.ok) changed += 1;
    }
    if (changed > 0) {
      await this.saveRule({ ...rule, matchedCount: rule.matchedCount + changed, lastUsedAt: workspaceToday() });
    }
    return { ok: true, value: { changed } };
  }

  async runRules(ruleIds: string[], range: { from?: string; to?: string }): Promise<Result<{ changed: number }>> {
    let total = 0;
    for (const id of ruleIds) {
      const r = await this.runRule(id, range);
      if (!r.ok) return r;
      total += r.value.changed;
    }
    return { ok: true, value: { changed: total } };
  }

  private async applyRuleActions(eventId: string, actions: RuleAction[]): Promise<Result> {
    const snapshot = await this.load();
    const event = snapshot.events.find((e) => e.id === eventId);
    if (!event) return { ok: false, error: 'missing_lines' };
    for (const action of actions) {
      if (action.kind === 'setCategory' && (event.type === 'expense' || event.type === 'income')) {
        const r = await this.bulkSetCategory([eventId], action.value);
        if (!r.ok) return r;
      }
      if (action.kind === 'renamePayee' && action.value.trim()) {
        const payeeId = await this.payeeFor(snapshot.payees, action.value.trim());
        const moved = await this.setEventPayee(eventId, payeeId);
        if (!moved.ok) return moved;
      }
      if (action.kind === 'addNote' && action.value.trim()) {
        const note = action.value.trim();
        const merged = event.notes ? `${event.notes}; ${note}` : note;
        await this.updateNotes(eventId, merged);
      }
    }
    return { ok: true, value: undefined };
  }

  /**
   * P07-06 / PU-12: move this category's transactions and plans to another, then soft-delete it.
   * Each move is a correction (TECH-SPEC 6.3). Returns undoId for toast Undo.
   */
  async deleteCategory(
    categoryId: string,
    moveToId: string,
    _date: string,
  ): Promise<Result<{ undoId: string }>> {
    if (categoryId === moveToId) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    const category = snapshot.categories.find((c) => c.id === categoryId);
    const target = snapshot.categories.find((c) => c.id === moveToId);
    if (!category || !target || category.kind !== target.kind) return { ok: false, error: 'missing_lines' };

    const replacementEventIds: string[] = [];
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
      replacementEventIds.push(corrected.value.id);
    }

    const planMoves: { month: string; amount: bigint; note: string }[] = [];
    for (const [key, amount] of snapshot.assigns) {
      if (!key.startsWith(`${categoryId}:`) || amount <= 0n) continue;
      const month = key.slice(categoryId.length + 1);
      const note = snapshot.assignNotes.get(key) ?? '';
      planMoves.push({ month, amount, note });
    }
    for (const plan of planMoves) {
      const snap = await this.load();
      await this.setAssigned(moveToId, plan.month, this.assigned(moveToId, plan.month, snap) + plan.amount, { note: plan.note });
      await this.setAssigned(categoryId, plan.month, 0n);
    }

    const undoId = this.newId();
    this.categoryDeleteUndos.set(undoId, { categoryId, moveToId, category, replacementEventIds, planMoves });
    await this.updateCategory({ ...category, deleted: true, hidden: true });
    return { ok: true, value: { undoId } };
  }

  /** PU12-3: restore a soft-deleted category and move transactions/plans back. */
  async undoDeleteCategory(undoId: string, _date: string): Promise<Result> {
    const data = this.categoryDeleteUndos.get(undoId);
    if (!data) return { ok: false, error: 'missing_lines' };
    await this.updateCategory({ ...data.category, deleted: false, hidden: data.category.hidden });
    for (const plan of data.planMoves) {
      const snap = await this.load();
      const targetAmt = this.assigned(data.moveToId, plan.month, snap);
      await this.setAssigned(data.moveToId, plan.month, targetAmt > plan.amount ? targetAmt - plan.amount : 0n);
      await this.setAssigned(data.categoryId, plan.month, plan.amount, { note: plan.note });
    }
    for (const eventId of [...data.replacementEventIds].reverse()) {
      const snap = await this.load();
      const event = snap.events.find((e) => e.id === eventId);
      if (!event || event.status !== 'posted') continue;
      const accountIds = new Set(snap.accounts.map((a) => a.id));
      const money = event.lines.find((l) => accountIds.has(l.ledgerAccountId));
      if (!money) continue;
      if (data.category.kind === 'expense') {
        const parts = event.lines
          .filter((l) => !accountIds.has(l.ledgerAccountId))
          .map((l) => ({
            categoryId: l.ledgerAccountId === data.moveToId ? data.categoryId : l.ledgerAccountId,
            amount: l.amountMinor < 0n ? -l.amountMinor : l.amountMinor,
          }));
        await this.correctTransaction(eventId, {
          kind: 'expense',
          accountId: money.ledgerAccountId,
          parts,
          date: event.date,
          notes: event.notes,
        });
      } else {
        const amount = event.lines
          .filter((l) => !accountIds.has(l.ledgerAccountId))
          .reduce((s, l) => s + (l.amountMinor < 0n ? -l.amountMinor : l.amountMinor), 0n);
        await this.correctTransaction(eventId, {
          kind: 'income',
          accountId: money.ledgerAccountId,
          categoryId: data.categoryId,
          amount,
          date: event.date,
          notes: event.notes,
        });
      }
    }
    this.categoryDeleteUndos.delete(undoId);
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
  async bulkSetCategory(eventIds: string[], categoryId: string): Promise<Result<{ skippedReconciled: number }>> {
    let skippedReconciled = 0;
    for (const id of eventIds) {
      const snapshot = await this.load();
      const event = snapshot.events.find((e) => e.id === id);
      if (!event || event.status !== 'posted' || (event.type !== 'expense' && event.type !== 'income')) continue;
      if (event.reconciledBy) {
        skippedReconciled += 1;
        continue;
      }
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
    return { ok: true, value: { skippedReconciled } };
  }

  async bulkDelete(eventIds: string[], date: string): Promise<Result> {
    for (const id of eventIds) {
      const deleted = await this.deleteTransaction(id, date);
      if (!deleted.ok) return deleted;
    }
    return { ok: true, value: undefined };
  }

  async bulkSetPayee(eventIds: string[], payeeId: string): Promise<Result<{ skippedReconciled: number }>> {
    let skippedReconciled = 0;
    for (const id of eventIds) {
      const snapshot = await this.load();
      const event = snapshot.events.find((e) => e.id === id);
      if (!event || event.status !== 'posted') continue;
      if (event.reconciledBy) {
        skippedReconciled += 1;
        continue;
      }
      const moved = await this.setEventPayee(id, payeeId);
      if (!moved.ok) return moved;
    }
    return { ok: true, value: { skippedReconciled } };
  }

  savedForGoal(goalId: string, snapshot: Snapshot): bigint {
    return snapshot.allocations
      .filter((a) => a.goalId === goalId)
      .reduce((s, a) => {
        const amount = BigInt(a.amountMinor);
        return a.kind === 'spend' ? s - amount : s + amount;
      }, 0n);
  }

  async addGoal(input: {
    name: string;
    targetMinor: bigint;
    accountId: string;
    targetDate?: string;
    categoryId?: string;
    icon?: string;
    notes?: string;
    /** Opening earmark already sitting in the goal account (PU-31). */
    alreadySavedMinor?: bigint;
  }): Promise<Result<Goal>> {
    if (!input.accountId.trim()) return { ok: false, error: 'missing_lines' };
    if (input.targetMinor <= 0n) return { ok: false, error: 'not_positive' };
    const snapshot = await this.load();
    if (!snapshot.accounts.some((a) => a.id === input.accountId && !a.archived)) return { ok: false, error: 'missing_lines' };
    if (input.alreadySavedMinor !== undefined && input.alreadySavedMinor < 0n) return { ok: false, error: 'not_positive' };
    const goal: Goal = {
      id: this.newId(),
      name: input.name.trim(),
      icon: input.icon,
      notes: input.notes,
      targetMinor: input.targetMinor.toString(),
      accountId: input.accountId,
      targetDate: input.targetDate,
      categoryId: input.categoryId,
      status: 'active',
    };
    const { id, ...data } = goal;
    await this.put('goals', id, data, 'goal.create', undefined, { type: 'goal.create', payload: goalBody(id, data) });
    if (input.alreadySavedMinor && input.alreadySavedMinor > 0n) {
      const allocated = await this.allocateToGoal(id, { amount: input.alreadySavedMinor, date: workspaceToday() });
      if (!allocated.ok) return allocated;
    }
    return { ok: true, value: goal };
  }

  async updateGoal(goal: Goal): Promise<void> {
    const { id, ...data } = goal;
    const baseVersion = await this.versionOf('goals', id);
    await this.put('goals', id, data, 'goal.update', undefined, { type: 'goal.update', targetId: id, payload: goalUpdateBody(data, baseVersion) });
  }

  /**
   * Delete a goal without moving money (PU-30-1). Allocations are cleared as metadata; balances stay in the account.
   */
  async deleteGoal(goalId: string): Promise<Result<void>> {
    const snapshot = await this.load();
    const goal = snapshot.goals.find((g) => g.id === goalId);
    if (!goal) return { ok: false, error: 'missing_lines' };
    for (const a of snapshot.allocations.filter((x) => x.goalId === goalId)) {
      await this.put('allocations', a.id, { ...a, deleted: true }, 'goal.allocation.clear', undefined, null);
    }
    const baseVersion = await this.versionOf('goals', goalId);
    await this.put('goals', goalId, { ...goal, deleted: true }, 'goal.delete', undefined, {
      type: 'goal.delete',
      targetId: goalId,
      payload: { baseVersion },
    });
    return { ok: true, value: undefined };
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
    // A different account moves the money first (E6); the server makes that transfer from goal.allocate.
    let transferId: string | undefined;
    if (fromId !== goal.accountId) {
      const lines = this.linesFor(snapshot.chart, { kind: 'transfer', fromId, toId: goal.accountId, amount: input.amount, date: input.date });
      if (!lines.ok) return lines;
      const moved = await this.postEvent(
        snapshot.chart,
        snapshot.events,
        { type: 'transfer', date: input.date, lines: lines.value.lines, notes: t('goals.transferNote', { name: goal.name }), goalId },
        null,
      );
      if (!moved.ok) return moved;
      transferId = moved.value.id;
    }
    const allocation: GoalAllocation = {
      id: this.newId(),
      goalId,
      amountMinor: input.amount.toString(),
      date: input.date,
      fromAccountId: fromId,
    };
    const { id, ...data } = allocation;
    await this.put('allocations', id, data, 'goal.allocate', undefined, {
      type: 'goal.allocate',
      targetId: goalId,
      payload: { id, date: input.date, amount: allocation.amountMinor, fromAccountId: fromId === goal.accountId ? null : fromId },
      transactionIds: transferId ? [transferId] : undefined,
    });
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
    await this.put('recurring', id, data, 'recurring.create', undefined, { type: 'schedule.create', payload: scheduleBody(id, data) });
    return recurring;
  }

  async updateRecurring(recurring: Recurring): Promise<void> {
    const { id, ...data } = recurring;
    const baseVersion = await this.versionOf('recurring', id);
    await this.put('recurring', id, data, 'recurring.update', undefined, {
      type: 'schedule.update',
      targetId: id,
      payload: scheduleUpdateBody(data, baseVersion),
    });
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
    // PU26-1: one transaction can't pay two occurrences.
    if (snapshot.occurrences.some((o) => o.eventId === eventId && o.status === 'paid')) return { ok: false, error: 'already_reversed' };
    const accountIds = new Set(snapshot.accounts.map((a) => a.id));
    // An expense credits the account it was paid from, so the money that left is minus the account lines.
    const amountMinor = -event.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => s + l.amountMinor, 0n);
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

  /** PU-26 — Undo mark paid (unlink occurrence; keeps the transaction). */
  async unmarkBillPaid(recurringId: string, dueDate: string): Promise<Result<void>> {
    const snapshot = await this.load();
    const occId = `${recurringId}:${dueDate}`;
    const existing = snapshot.occurrences.find((o) => o.id === occId);
    if (!existing || existing.status !== 'paid') return { ok: false, error: 'missing_lines' };
    await this.put(
      'occurrences',
      occId,
      { recurringId, dueDate, amountMinor: existing.amountMinor, status: 'upcoming', eventId: undefined },
      'occurrence.unpaid',
    );
    return { ok: true, value: undefined };
  }

  async addIncomeStream(input: Omit<IncomeStream, 'id'>): Promise<IncomeStream> {
    const id = this.newId();
    const stream: IncomeStream = { ...input, id };
    const { id: _id, ...data } = stream;
    await this.put('income_streams', id, data, 'income_stream.create', undefined, {
      type: 'income.stream.create',
      payload: incomeStreamBody(id, data, todayInLagos()),
    });
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
    bankNames?: string[];
    notes?: string;
    interest?: PersonDebt['interest'];
    dueDate?: string;
  }): Promise<Result<PersonDebt>> {
    const snapshot = await this.load();
    const id = this.newId();
    const ledgerAccountId = `${this.workspaceId}:debt:${id}`;
    let payeeId: string | undefined;
    const person = input.name.trim() || input.payeeName?.trim() || t('debts.unnamed');
    const payeeSeed = input.payeeName?.trim() || person;
    if (payeeSeed) {
      payeeId = await this.payeeFor(snapshot.payees, payeeSeed);
      const aliases = new Set(
        (input.bankNames ?? []).map((a) => a.trim().toUpperCase()).filter(Boolean),
      );
      // Keep the person's display name as an alias when the payee was seeded from a bank string.
      if (person && person.toLowerCase() !== payeeSeed.toLowerCase()) aliases.add(person);
      if (aliases.size && payeeId) {
        const fresh = await this.load();
        const payee = fresh.payees.find((p) => p.id === payeeId);
        if (payee) {
          const merged = new Set([...(payee.aliases ?? []), ...aliases]);
          await this.updatePayee({ ...payee, aliases: [...merged] });
        }
      }
    }
    const debt: PersonDebt = {
      id,
      name: person,
      direction: input.direction,
      ledgerAccountId,
      payeeId,
      status: 'open',
      notes: input.notes,
      interest: input.interest,
      nextDueDate: input.dueDate,
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
    }, null);
    if (!posted.ok) return posted;
    const { id: _debtId, ...debtData } = debt;
    await this.put('debts', id, debtData, 'debt.open', undefined, {
      type: input.direction === 'owedToMe' ? 'debt.lend' : 'debt.borrow',
      payload: {
        id,
        personName: debt.name,
        ...(payeeId ? { payeeId } : {}),
        amount: input.amount.toString(),
        accountId: input.accountId,
        date: input.date,
        interest: input.interest ?? { kind: 'none' },
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
      },
      transactionIds: [posted.value.id],
    });
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

  /**
   * TECH-SPEC 6.15 / BE confirmMoneyBack: never posts money back without this choice.
   * `money_back` → E16/E14 against the debt; `income` keeps or posts E1.
   */
  async confirmMoneyBack(
    suggestion: {
      debtId: string;
      amount: bigint;
      date: string;
      accountId: string;
      eventId?: string;
      payeeId?: string;
    },
    choice: 'money_back' | 'income',
    opts?: { categoryId?: string },
  ): Promise<Result<TxEvent>> {
    if (choice === 'money_back') {
      if (suggestion.eventId) {
        const snapshot = await this.load();
        const event = snapshot.events.find((e) => e.id === suggestion.eventId);
        if (event && event.status === 'posted' && (event.type === 'income' || event.type === 'expense')) {
          const reversed = await this.deleteTransaction(event.id, suggestion.date);
          if (!reversed.ok) return reversed;
        }
      }
      return this.recordDebtPayment(suggestion.debtId, {
        accountId: suggestion.accountId,
        amount: suggestion.amount,
        date: suggestion.date,
      });
    }
    if (suggestion.eventId) {
      const snapshot = await this.load();
      const event = snapshot.events.find((e) => e.id === suggestion.eventId);
      if (event) return { ok: true, value: event };
      return { ok: false, error: 'missing_lines' };
    }
    if (!opts?.categoryId) return { ok: false, error: 'missing_lines' };
    return this.addTransaction({
      kind: 'income',
      accountId: suggestion.accountId,
      categoryId: opts.categoryId,
      amount: suggestion.amount,
      date: suggestion.date,
      payeeName: undefined,
    });
  }

  async recordDebtPayment(
    debtId: string,
    input: {
      accountId: string;
      amount: bigint;
      date: string;
      interest?: bigint;
      /** TECH-SPEC 6.9: extra beyond outstanding as gift (income/expense) or credit on the debt. */
      overpayment?: 'gift' | 'credit';
    },
  ): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const debt = snapshot.debts.find((d) => d.id === debtId);
    if (!debt || debt.status !== 'open') return { ok: false, error: 'missing_lines' };
    const balance = this.debtBalance(debt, snapshot, input.date);
    const interest = input.interest ?? 0n;
    const requestedPrincipal = input.amount;
    const principal = requestedPrincipal > balance ? balance : requestedPrincipal;
    const extra = requestedPrincipal > balance ? requestedPrincipal - balance : 0n;
    if (principal <= 0n && interest <= 0n && extra <= 0n) return { ok: false, error: 'not_positive' };
    if (extra > 0n && !input.overpayment) return { ok: false, error: 'not_positive' };

    const lines =
      debt.direction === 'owedToMe'
        ? buildCollect(snapshot.chart, { receivableId: debt.ledgerAccountId, accountId: input.accountId, principal, interest })
        : buildLoanRepayment(snapshot.chart, { payableId: debt.ledgerAccountId, accountId: input.accountId, principal, interest });
    if (!lines.ok) return lines;
    const posted = await this.postEvent(snapshot.chart, snapshot.events, {
      type: debt.direction === 'owedToMe' ? 'collect' : 'loan_repayment',
      date: input.date,
      lines: lines.value,
      debtId,
    }, null);
    if (!posted.ok) return posted;

    if (extra > 0n && input.overpayment === 'gift') {
      const incomeCat = snapshot.categories.find((c) => c.kind === 'income' && !c.deleted);
      const expenseCat = snapshot.categories.find((c) => c.kind === 'expense' && !c.deleted);
      if (debt.direction === 'owedToMe' && incomeCat) {
        await this.addTransaction({
          kind: 'income',
          accountId: input.accountId,
          categoryId: incomeCat.id,
          amount: extra,
          date: input.date,
          payeeName: debt.name,
          notes: t('debts.overpayGiftNote'),
        });
      } else if (debt.direction === 'iOwe' && expenseCat) {
        await this.addTransaction({
          kind: 'expense',
          accountId: input.accountId,
          parts: [{ categoryId: expenseCat.id, amount: extra }],
          date: input.date,
          payeeName: debt.name,
          notes: t('debts.overpayGiftNote'),
        });
      }
    }

    const entry: DebtEntry = {
      id: this.newId(),
      debtId,
      date: input.date,
      eventId: posted.value.id,
      kind: 'payment',
      amountMinor: principal.toString(),
      interestMinor: interest > 0n ? interest.toString() : undefined,
    };
    await this.put('debt_entries', entry.id, { debtId: entry.debtId, date: entry.date, eventId: entry.eventId, kind: entry.kind, amountMinor: entry.amountMinor, interestMinor: entry.interestMinor }, 'debt.entry', undefined, {
      type: 'debt.payment',
      targetId: debtId,
      payload: {
        date: input.date,
        accountId: input.accountId,
        amount: (principal + interest).toString(),
        split: { principal: principal.toString(), interest: interest.toString() },
        overpayment: input.overpayment ?? null,
      },
      transactionIds: [posted.value.id],
    });
    const after = await this.load();
    const left = this.debtBalance(debt, after, input.date);
    const creditExtra = extra > 0n && input.overpayment === 'credit' ? extra : 0n;
    const creditMinor = (BigInt(debt.creditMinor ?? '0') + creditExtra).toString();
    if (left <= 0n) {
      await this.put(
        'debts',
        debtId,
        {
          name: debt.name,
          direction: debt.direction,
          ledgerAccountId: debt.ledgerAccountId,
          payeeId: debt.payeeId,
          status: 'settled',
          interest: debt.interest,
          notes: debt.notes,
          creditMinor: creditExtra > 0n ? creditMinor : debt.creditMinor,
        },
        'debt.settle',
      );
    } else if (creditExtra > 0n) {
      await this.updatePersonDebt({ ...debt, creditMinor });
    }
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
    }, null);
    if (!posted.ok) return posted;
    const baseVersion = await this.versionOf('debts', debtId);
    await this.put('debts', debtId, { ...debt, status: 'written_off' }, 'debt.write_off', undefined, {
      type: 'debt.write_off',
      targetId: debtId,
      payload: { date: input.date, baseVersion },
      transactionIds: [posted.value.id],
    });
    return { ok: true, value: posted.value };
  }

  async updatePersonDebt(debt: PersonDebt): Promise<void> {
    const { id, ...data } = debt;
    await this.put('debts', id, data, 'debt.update');
  }

  async markPersonDebtSettled(debtId: string): Promise<Result<void>> {
    const snapshot = await this.load();
    const debt = snapshot.debts.find((d) => d.id === debtId);
    if (!debt || debt.status !== 'open') return { ok: false, error: 'missing_lines' };
    const balance = this.debtBalance(debt, snapshot);
    if (balance > 0n) return { ok: false, error: 'not_positive' };
    await this.updatePersonDebt({ ...debt, status: 'settled' });
    return { ok: true, value: undefined };
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

  /** Mark unread notifications read. When `category` is set (TB-12), only that chip's kinds are marked. */
  async markAllNotificationsRead(category?: NotificationCategory | 'all'): Promise<void> {
    const rows = await this.store.list('notifications');
    for (const r of rows) {
      const n = r.data as AppNotification;
      if (n.read) continue;
      if (category && category !== 'all' && n.category !== category) continue;
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
    const baseVersion = await this.versionOf('income_streams', id);
    await this.put('income_streams', id, data, 'income_stream.update', undefined, {
      type: 'income.stream.update',
      targetId: id,
      payload: incomeStreamUpdateBody(data, baseVersion),
    });
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
    }, null);
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
    await this.put('allocations', id, data, 'goal.spend', undefined, {
      type: 'goal.spend',
      targetId: goalId,
      payload: { id, date: input.date, amount: allocation.amountMinor, categoryId: input.categoryId, accountId: input.accountId, payeeId: payeeId ?? null },
      transactionIds: [posted.value.id],
    });
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
        : buildTransfer(chart, {
            fromId: input.fromId,
            toId: input.toId,
            amount: input.amount,
            toAmount: input.toAmount,
          });
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

  /** PU-37: add a holding; creates its ledger asset and moves no money. */
  async createHolding(input: {
    name: string;
    symbol?: string;
    type: HoldingType;
    accountId: string;
    currency?: string;
    currentPriceMinor?: bigint;
  }): Promise<Result<Holding>> {
    const snapshot = await this.load();
    const parent = snapshot.accounts.find((a) => a.id === input.accountId && a.type === 'investment' && !a.archived);
    if (!parent) return { ok: false, error: 'wrong_account_kind' };
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'missing_lines' };
    const id = this.newId();
    const ledgerAccountId = this.newId();
    const holding: Holding = {
      id,
      name,
      symbol: input.symbol?.trim().toUpperCase() || undefined,
      type: input.type,
      accountId: parent.id,
      currency: input.currency ?? parent.currency,
      ledgerAccountId,
    };
    const { id: _id, ...data } = holding;
    await this.put('holdings', id, data, 'holding.create');
    if (input.currentPriceMinor !== undefined && input.currentPriceMinor > 0n) {
      const priceId = this.newId();
      await this.put(
        'prices',
        priceId,
        { holdingId: id, date: todayInLagos(), priceMinor: input.currentPriceMinor.toString() } satisfies Omit<HoldingPrice, 'id'>,
        'price.upsert',
      );
    }
    return { ok: true, value: holding };
  }

  async updateHolding(holding: Holding): Promise<void> {
    const { id, ...data } = holding;
    await this.put('holdings', id, data, 'holding.update');
  }

  /** PU-38 buy (E20): cash → holding at cost; records a lot. */
  async buyHolding(input: {
    holdingId: string;
    units: string;
    pricePerUnit: bigint;
    fees?: bigint;
    cashAccountId: string;
    date: string;
  }): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const holding = snapshot.holdings.find((h) => h.id === input.holdingId);
    if (!holding) return { ok: false, error: 'unknown_account' };
    const fees = input.fees ?? 0n;
    const chart = this.chartFor(snapshot.accounts, snapshot.categories, snapshot.debts, snapshot.holdings);
    const lines = buildInvestmentBuy(chart, {
      holdingAccountId: holding.ledgerAccountId,
      cashAccountId: input.cashAccountId,
      units: input.units,
      pricePerUnit: input.pricePerUnit,
      fees,
    });
    if (!lines.ok) return lines;
    const posted = await this.postEvent(chart, snapshot.events, {
      type: 'investment_buy',
      date: input.date,
      lines: lines.value,
    });
    if (!posted.ok) return posted;
    const cost = costOfPurchase(input.units, input.pricePerUnit, fees);
    const lotId = this.newId();
    await this.put(
      'lots',
      lotId,
      {
        holdingId: holding.id,
        date: input.date,
        units: input.units,
        soldUnits: '0',
        costMinor: cost.toString(),
        pricePerUnitMinor: input.pricePerUnit.toString(),
        feesMinor: fees.toString(),
        buyEventId: posted.value.id,
      } satisfies Omit<HoldingLot, 'id'>,
      'lot.create',
    );
    return posted;
  }

  /** PU-38 sell (E21): FIFO by default. */
  async sellHolding(input: {
    holdingId: string;
    units: string;
    pricePerUnit: bigint;
    fees?: bigint;
    cashAccountId: string;
    date: string;
    costOfLots?: bigint;
  }): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const holding = snapshot.holdings.find((h) => h.id === input.holdingId);
    if (!holding) return { ok: false, error: 'unknown_account' };
    const want = Number(input.units);
    const open = snapshot.lots
      .filter((l) => l.holdingId === holding.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let left = want;
    let cost = 0n;
    const consumes: { lot: HoldingLot; take: number }[] = [];
    for (const lot of open) {
      const available = Number(lot.units) - Number(lot.soldUnits || '0');
      if (available <= 0) continue;
      const take = Math.min(available, left);
      const lotUnits = Number(lot.units);
      const portion = lotUnits > 0 ? (BigInt(lot.costMinor) * BigInt(Math.round(take * 1e6))) / BigInt(Math.round(lotUnits * 1e6)) : 0n;
      cost += portion;
      consumes.push({ lot, take });
      left -= take;
      if (left <= 1e-9) break;
    }
    if (left > 1e-9) return { ok: false, error: 'not_positive' };
    const costOfLots = input.costOfLots ?? cost;
    const chart = this.chartFor(snapshot.accounts, snapshot.categories, snapshot.debts, snapshot.holdings);
    const lines = buildInvestmentSell(chart, {
      holdingAccountId: holding.ledgerAccountId,
      cashAccountId: input.cashAccountId,
      units: input.units,
      pricePerUnit: input.pricePerUnit,
      fees: input.fees ?? 0n,
      costOfLots,
    });
    if (!lines.ok) return lines;
    const posted = await this.postEvent(chart, snapshot.events, {
      type: 'investment_sell',
      date: input.date,
      lines: lines.value,
    });
    if (!posted.ok) return posted;
    for (const { lot, take } of consumes) {
      const sold = (Number(lot.soldUnits || '0') + take).toString();
      const { id, ...data } = lot;
      await this.put('lots', id, { ...data, soldUnits: sold }, 'lot.update');
    }
    return posted;
  }

  /** PU-39 dividend: income to cash; optional reinvest lot (E22). */
  async recordDividend(input: {
    holdingId: string;
    amount: bigint;
    date: string;
    cashAccountId: string;
    reinvested?: boolean;
    units?: string;
    pricePerUnit?: bigint;
  }): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const holding = snapshot.holdings.find((h) => h.id === input.holdingId);
    if (!holding) return { ok: false, error: 'unknown_account' };
    const chart = this.chartFor(snapshot.accounts, snapshot.categories, snapshot.debts, snapshot.holdings);
    const sys = chart.system('investment_income');
    if (!sys) return { ok: false, error: 'unknown_account' };
    if (input.reinvested && input.units && input.pricePerUnit !== undefined) {
      // Reinvested: Dr H · Cr investment income; new lot (TECH-SPEC E22).
      const cost = costOfPurchase(input.units, input.pricePerUnit, 0n);
      if (cost <= 0n) return { ok: false, error: 'not_positive' };
      const posted = await this.postEvent(chart, snapshot.events, {
        type: 'income',
        date: input.date,
        lines: [
          { ledgerAccountId: holding.ledgerAccountId, amountMinor: cost, currency: holding.currency },
          { ledgerAccountId: sys.id, amountMinor: -cost, currency: holding.currency },
        ],
      });
      if (!posted.ok) return posted;
      await this.put(
        'lots',
        this.newId(),
        {
          holdingId: holding.id,
          date: input.date,
          units: input.units,
          soldUnits: '0',
          costMinor: cost.toString(),
          pricePerUnitMinor: input.pricePerUnit.toString(),
          feesMinor: '0',
          buyEventId: posted.value.id,
        } satisfies Omit<HoldingLot, 'id'>,
        'lot.create',
      );
      return posted;
    }
    const cash = chart.get(input.cashAccountId);
    if (!cash) return { ok: false, error: 'unknown_account' };
    if (input.amount <= 0n) return { ok: false, error: 'not_positive' };
    return this.postEvent(chart, snapshot.events, {
      type: 'income',
      date: input.date,
      lines: [
        { ledgerAccountId: cash.id, amountMinor: input.amount, currency: cash.currency },
        { ledgerAccountId: sys.id, amountMinor: -input.amount, currency: cash.currency },
      ],
    });
  }

  /** PU-40: save filled prices; empty rows keep the old price. */
  async savePrices(rows: { holdingId: string; priceMinor: bigint }[], date: string): Promise<void> {
    for (const row of rows) {
      if (row.priceMinor <= 0n) continue;
      await this.put(
        'prices',
        this.newId(),
        { holdingId: row.holdingId, date, priceMinor: row.priceMinor.toString() } satisfies Omit<HoldingPrice, 'id'>,
        'price.upsert',
      );
    }
  }

  defaultHealthSettings(snapshot: Snapshot): HealthSettings {
    const cashTypes = new Set(['bank', 'savings', 'cash', 'wallet']);
    return (
      snapshot.settings.health ?? {
        cashAccountIds: snapshot.accounts.filter((a) => !a.archived && cashTypes.has(a.type)).map((a) => a.id),
        emergencyMonths: 6,
        countInvestmentsInRunway: false,
        essentialCategoryIds: snapshot.categories.filter((c) => c.kind === 'expense' && c.budgetType === 'fixed').map((c) => c.id),
      }
    );
  }

  async saveHealthSettings(health: HealthSettings): Promise<void> {
    const snapshot = await this.load();
    await this.put('settings', 'workspace', { ...snapshot.settings, health }, 'settings.update');
  }

  async ensureReportDashboards(): Promise<ReportDashboard[]> {
    const snapshot = await this.load();
    if (snapshot.settings.reportDashboards?.length) return snapshot.settings.reportDashboards;
    const overview: ReportDashboard = {
      id: this.newId(),
      name: 'Overview',
      order: 0,
      cards: [
        { id: this.newId(), kind: 'spendingByCategory', title: 'Spending by category' },
        { id: this.newId(), kind: 'incomeVsSpending', title: 'Income vs spending' },
        { id: this.newId(), kind: 'netWorth', title: 'Net worth' },
        { id: this.newId(), kind: 'cashFlow', title: 'Cash flow' },
      ],
    };
    await this.put('settings', 'workspace', { ...snapshot.settings, reportDashboards: [overview] }, 'settings.update');
    return [overview];
  }

  async saveReportDashboards(dashboards: ReportDashboard[]): Promise<void> {
    const snapshot = await this.load();
    await this.put('settings', 'workspace', { ...snapshot.settings, reportDashboards: dashboards }, 'settings.update');
  }

  async saveSavedReport(report: Omit<SavedReport, 'id'> & { id?: string }): Promise<SavedReport> {
    const snapshot = await this.load();
    const saved: SavedReport = { ...report, id: report.id ?? this.newId() };
    const list = [...(snapshot.settings.savedReports ?? []).filter((r) => r.id !== saved.id), saved];
    await this.put('settings', 'workspace', { ...snapshot.settings, savedReports: list }, 'settings.update');
    return saved;
  }

  /** `remote: null` when another write of the same action tells the server (a debt, a goal), so it posts once. */
  private async postEvent(
    chart: Chart,
    events: TxEvent[],
    input: Omit<MoneyEvent, 'id' | 'operationId' | 'status' | 'lines'> & { lines: Line[] } & EventMeta,
    remote?: null,
  ): Promise<Result<TxEvent>> {
    const id = this.newId();
    const event: TxEvent = { ...input, id, operationId: id, status: 'posted' };
    const checked = checkEvent(chart, event, new Map(events.map((e) => [e.id, e])));
    if (!checked.ok) return checked;
    await this.put('events', id, { ...toStored(input), operationId: id }, `event.${input.type}`, undefined, remote);
    return { ok: true, value: event };
  }
}
