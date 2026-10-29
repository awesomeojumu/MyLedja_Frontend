import type { TextKey } from '@/i18n';
import type { EventType, InvestmentMeta, LedgerKind, Line, MoneyEvent } from '@/ledger';

/** DESIGN.md page 8 groups, in order. */
export const ACCOUNT_GROUPS = ['cashBank', 'cards', 'investments', 'property', 'loans', 'other'] as const;
export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];

export const ACCOUNT_KINDS = ['bank', 'savings', 'cash', 'wallet', 'card', 'investment', 'property', 'loan', 'other'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_INFO: Record<AccountKind, { group: AccountGroup; ledger: LedgerKind; countInBudget: boolean }> = {
  bank: { group: 'cashBank', ledger: 'asset', countInBudget: true },
  savings: { group: 'cashBank', ledger: 'asset', countInBudget: true },
  cash: { group: 'cashBank', ledger: 'asset', countInBudget: true },
  wallet: { group: 'cashBank', ledger: 'asset', countInBudget: true },
  card: { group: 'cards', ledger: 'liability', countInBudget: true },
  investment: { group: 'investments', ledger: 'asset', countInBudget: false },
  property: { group: 'property', ledger: 'asset', countInBudget: false },
  loan: { group: 'loans', ledger: 'liability', countInBudget: false },
  other: { group: 'other', ledger: 'asset', countInBudget: false },
};

export type Account = {
  id: string;
  name: string;
  type: AccountKind;
  currency: string;
  institution?: string;
  /** Only ever the last 4 digits; MyLedja never stores a full account number (P08-04). */
  last4?: string;
  countInBudget: boolean;
  archived: boolean;
  order: number;
  /** The last CSV column mapping used for this account (P09-05). */
  importMapping?: ImportMapping;
};

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export type ImportMapping = {
  date: number;
  /** Either one signed amount column, or separate money in and money out columns. */
  amount: number | null;
  moneyIn: number | null;
  moneyOut: number | null;
  description: number | null;
  payee: number | null;
  notes: number | null;
  dateFormat: DateFormat;
  hasHeader: boolean;
};

/** DESIGN.md page 6/7: Fixed / Flexible / Non-monthly / Savings. */
export const BUDGET_TYPES = ['fixed', 'flexible', 'nonMonthly', 'savings'] as const;
export type BudgetType = (typeof BUDGET_TYPES)[number];

export type Category = {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  group: string;
  /** For starter categories, the catalogue key; the name follows the person's edits. */
  key?: TextKey;
  /** Hide from the Budget page (P07-05). */
  hidden: boolean;
  countInBudget: boolean;
  order: number;
  budgetType: BudgetType;
  /** Tracking style: leftover carries when on (TECH-SPEC 6.6). */
  carryOver: boolean;
  /** Soft-deleted after reassignment (Q-18); filtered out of the snapshot. */
  deleted?: boolean;
  /** Counts in Health's runway (TECH-SPEC 6.10). Fixed categories and the Home, Food, Getting around, Health and Education groups count by default. */
  essential?: boolean;
};

export type Payee = {
  id: string;
  name: string;
  defaultCategoryId?: string;
  /** Bank import names that map here (P24-03). */
  aliases?: string[];
  /** Optional logo (local URI or remote); DESIGN page 24. */
  logoUri?: string;
  deleted?: boolean;
};

/** Transaction sorting rules (DESIGN page 25, TECH-SPEC rules collection). */
export type RuleStage = 'first' | 'normal' | 'last';

export type RuleConditionField = 'payee' | 'description' | 'amount' | 'account' | 'category' | 'notes' | 'date';

export type RuleConditionOp = 'contains' | 'equals' | 'lessThan' | 'greaterThan' | 'before' | 'after';

export type RuleCondition = { field: RuleConditionField; op: RuleConditionOp; value: string };

export type RuleActionKind = 'setCategory' | 'renamePayee' | 'addNote';

export type RuleAction = { kind: RuleActionKind; value: string };

export type TransactionRule = {
  id: string;
  enabled: boolean;
  stage: RuleStage;
  order: number;
  matchMode: 'all' | 'any';
  conditions: RuleCondition[];
  actions: RuleAction[];
  matchedCount: number;
  lastUsedAt?: string;
};

export type BudgetStyle = 'tracking' | 'envelope';

/** Popup #6 — card visibility and order (DESIGN.md page 5). */
export type DashboardLayout = {
  order: string[];
  hidden: string[];
};

/** Settings › AI features (DESIGN page 26). */
export type AiFeaturePrefs = {
  suggestCategories: boolean;
  readStatements: boolean;
};

export const DEFAULT_AI_PREFS: AiFeaturePrefs = {
  suggestCategories: true,
  readStatements: false,
};

/** Manual or downloaded FX row (Settings › Currencies). */
export type ExchangeRateEntry = {
  id: string;
  currency: string;
  date: string;
  rate: string;
  source: 'manual' | 'download';
};

/** Health settings (DESIGN.md page 23). */
export type HealthSettings = {
  /** Accounts that count as cash; undefined means bank, cash, wallet and savings. */
  cashAccountIds?: string[];
  targetMonths: 3 | 6 | 12;
  countInvestments: boolean;
};

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = { targetMonths: 6, countInvestments: false };

/** Which budget category types appear in the budget UI (Settings › Budget). */
export type BudgetTypesShown = {
  fixed: boolean;
  flexible: boolean;
  nonMonthly: boolean;
  savings: boolean;
};

export const DEFAULT_BUDGET_TYPES_SHOWN: BudgetTypesShown = {
  fixed: true,
  flexible: true,
  nonMonthly: true,
  savings: true,
};

/** Settings › Devices & sync. */
export type DeviceSyncPrefs = {
  useLessData: boolean;
  lastSyncedLabel?: string;
};

export const DEFAULT_DEVICE_SYNC: DeviceSyncPrefs = {
  useLessData: false,
  lastSyncedLabel: undefined,
};

/** Workspace preferences chosen in Welcome and Settings (Phase 1 subset). */
export type WorkspaceSettings = {
  budgetStyle: BudgetStyle;
  currency: string;
  weekStart: 'monday' | 'sunday' | 'saturday';
  checklistHidden?: boolean;
  dashboardLayout?: DashboardLayout;
  notificationPrefs?: NotificationPrefs;
  aiPrefs?: AiFeaturePrefs;
  carryOverDefault?: boolean;
  budgetTypesShown?: BudgetTypesShown;
  exchangeRates?: ExchangeRateEntry[];
  downloadDailyRates?: boolean;
  deviceSync?: DeviceSyncPrefs;
  healthSettings?: HealthSettings;
};

/** Settings › Notifications (P26-05). */
export type NotificationPrefs = {
  bills: boolean;
  budget: boolean;
  goals: boolean;
  debts: boolean;
  income: boolean;
  security: boolean;
  weeklySummary: boolean;
  /** Days before a bill is due, e.g. 1, 3, 7 (DESIGN.md Page 26). */
  billReminderDays: number[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
  /** Default on: hide amounts on the lock screen (DESIGN.md Page 26 / 10.3). */
  hideAmountsOnLockScreen: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  bills: true,
  budget: true,
  goals: true,
  debts: true,
  income: true,
  security: true,
  weeklySummary: true,
  billReminderDays: [1, 3, 7],
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  hideAmountsOnLockScreen: true,
};

/** Budget template rule kinds (DESIGN popup #9). */
export type BudgetTemplateRuleKind = 'monthly' | 'saveBy' | 'coverBill' | 'average' | 'cap';

/** Budget template line (P06-10). Legacy rows may only set amountMinor. */
export type BudgetTemplateLine = {
  categoryId: string;
  amountMinor?: string;
  ruleKind?: BudgetTemplateRuleKind;
  /** saveBy: targetMinor, targetMonth. coverBill: recurringId. average: months. cap: maxMinor. */
  ruleMeta?: Record<string, string>;
};

export type BudgetTemplate = {
  id: string;
  name: string;
  lines: BudgetTemplateLine[];
};

/** Planned amount for one category in one month, stored as kobo string. */
export type BudgetAssign = { categoryId: string; month: string; amountMinor: string; note?: string };

export const budgetAssignId = (categoryId: string, month: string) => `${categoryId}:${month}`;

/** DESIGN.md page 14 — saving target tied to an account (P14-02). */
export type Goal = {
  id: string;
  name: string;
  targetMinor: string;
  targetDate?: string;
  accountId: string;
  categoryId?: string;
  status: 'active' | 'paused' | 'completed';
  /** Optional monthly schedule (P14-04). */
  scheduleAmountMinor?: string;
  scheduleDayOfMonth?: number;
};

/** Earmark into a goal (TECH-SPEC E18); amounts are kobo strings. */
export type GoalAllocation = {
  id: string;
  goalId: string;
  amountMinor: string;
  date: string;
  fromAccountId: string;
  /** Spending from goal (E19) stores a negative amount. */
  kind?: 'allocate' | 'spend';
};

export type RecurrenceEvery = 'day' | 'week' | 'month' | 'year';

/** How often a bill or income stream repeats (P12-03). */
export type RecurrenceRule = {
  every: RecurrenceEvery;
  /** Day: interval in days; week: weekday 0–6; month: day 1–31 (31 = last); year: day of month. */
  on: number;
  /** Repeat every N days/weeks/months/years (default 1). */
  interval?: number;
  /** Month 1–12 when `every` is `year`. */
  monthOfYear?: number;
};

export type RecurringKind = 'bill' | 'subscription' | 'transfer' | 'income';

export type Recurring = {
  id: string;
  kind: RecurringKind;
  name: string;
  amountMinor: string;
  approximate?: boolean;
  accountId: string;
  categoryId?: string;
  payeeId?: string;
  rule: RecurrenceRule;
  startDate: string;
  endDate?: string;
  autoCreate?: boolean;
  /** DESIGN #25 — stop after this many occurrences (optional; endDate also ends the series). */
  endAfterCount?: number;
  /** Days before due: 0 = on the day, 1, 3, or 7. */
  reminderDays?: number;
  /** DESIGN #25 — hide amount on lock screen (default on). */
  hideAmountOnLock?: boolean;
  cancelled?: boolean;
};

export type RecurringOccurrence = {
  id: string;
  recurringId: string;
  dueDate: string;
  amountMinor: string;
  status: 'upcoming' | 'paid' | 'missed';
  eventId?: string;
};

export type IncomeStreamKind = 'regular' | 'variable' | 'irregular' | 'passive';

export type IncomeAmountKind = 'exact' | 'approximate' | 'range';

export type IncomeRecordMode = 'takeHome' | 'gross';

export type IncomeDeductionKind = 'paye' | 'pension' | 'nhf' | 'other';

/** PAYE → Taxes, pension/NHF → accounts (DESIGN §9.4). */
export type IncomeDeduction = {
  kind: IncomeDeductionKind;
  amountMinor?: string;
  percent?: number;
  label?: string;
  targetAccountId?: string;
  targetCategoryId?: string;
};

export type IncomeRouting = {
  goalId?: string;
  categoryId?: string;
  amountMinor?: string;
  percent?: number;
  restToBudget?: boolean;
};

export type IncomeReminder = 'none' | 'sameDay' | '1' | '3' | '7';

export type IncomeStream = {
  id: string;
  name: string;
  kind: IncomeStreamKind;
  expectedMinor: string;
  accountId: string;
  categoryId: string;
  rule: RecurrenceRule;
  countInBudget: boolean;
  /** For tax-class report (P13-08). */
  taxClass?: string;
  amountKind?: IncomeAmountKind;
  rangeMinMinor?: string;
  rangeMaxMinor?: string;
  recordMode?: IncomeRecordMode;
  grossMinor?: string;
  deductions?: IncomeDeduction[];
  routing?: IncomeRouting[];
  reminder?: IncomeReminder;
};

export type DebtDirection = 'owedToMe' | 'iOwe';

/** Person debt (DESIGN.md page 15); bank loans use account type loan instead. */
export type PersonDebt = {
  id: string;
  name: string;
  direction: DebtDirection;
  /** Ledger account id for R (asset) or P (liability). */
  ledgerAccountId: string;
  payeeId?: string;
  status: 'open' | 'settled';
  nextDueDate?: string;
  notes?: string;
  /** Instalment plan (DESIGN popup #36). */
  scheduleInstallmentCount?: number;
  scheduleAmountMinor?: string;
  scheduleEvery?: 'week' | 'month';
  scheduleFirstDue?: string;
};

export type DebtEntry = {
  id: string;
  debtId: string;
  date: string;
  eventId: string;
  kind: 'lend' | 'borrow' | 'payment' | 'write_off';
  amountMinor: string;
  interestMinor?: string;
  note?: string;
};

export type NotificationCategory = 'bills' | 'budget' | 'goals' | 'debts' | 'income' | 'security';

export type NotificationAction =
  | 'mark_paid'
  | 'match'
  | 'remind_tomorrow'
  | 'record_payment'
  | 'see_budget'
  | 'open_plan'
  | 'open_debt'
  | 'security_review';

/** In-app notification (DESIGN.md page 27). */
export type AppNotification = {
  id: string;
  createdAt: string;
  title: string;
  body?: string;
  category: NotificationCategory;
  read: boolean;
  action?: NotificationAction;
  recurringId?: string;
  debtId?: string;
  dueDate?: string;
  amountMinor?: string;
  /** Lock-screen safe: omit amount in push copy when true (default). */
  hideAmount?: boolean;
  snoozedUntil?: string;
};

/** DESIGN.md page 17, Add / edit holding. */
export const HOLDING_TYPES = ['stock', 'fund', 'pension', 'crypto', 'fixed_deposit', 'other'] as const;
export type HoldingType = (typeof HOLDING_TYPES)[number];

/** An investment (TECH-SPEC 6.8). Its id is also its ledger account's id; it uses its account's currency. */
export type Holding = {
  id: string;
  name: string;
  symbol?: string;
  type: HoldingType;
  accountId: string;
  currency: string;
  archived: boolean;
};

/** A price typed in for one holding on one day. Not a money event (M17). */
export type HoldingPrice = { id: string; holdingId: string; date: string; priceMinor: string };

/** An exchange rate typed in by hand: home currency per one unit of `currency` (TECH-SPEC 6.5). */
export type ExchangeRate = { id: string; currency: string; date: string; rate: string };

export const REPORT_KINDS = [
  'net_worth',
  'income_vs_expenses',
  'spending_by_category',
  'spending_trends',
  'cash_flow',
  'transaction_calendar',
  'summary_number',
  'budget_analysis',
  'age_of_money',
  'balance_forecast',
  'crossover',
  'investment_performance',
  'debt_payoff',
  'income_steadiness',
  'formula',
  'note',
  'custom',
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export type ReportChart = 'bar' | 'line' | 'area' | 'donut' | 'table' | 'number' | 'sankey' | 'calendar' | 'note';
export type RangePreset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'last_12_months' | 'all';
export type ReportInterval = 'day' | 'week' | 'month' | 'year';

export type ReportFiltersModel = {
  accountIds?: string[];
  categoryIds?: string[];
  payeeIds?: string[];
  tagIds?: string[];
  types?: string[];
};

/** Report builder choices (DESIGN.md page 21). */
export type BuilderSpecModel = {
  show: 'spending' | 'income' | 'net' | 'balance' | 'count';
  groupBy: 'category' | 'group' | 'payee' | 'account' | 'tag' | 'month';
  splitBy: 'category' | 'group' | 'payee' | 'account' | 'tag' | 'month' | null;
  chart: ReportChart;
  filters: ReportFiltersModel;
};

export type ReportCardModel = {
  id: string;
  kind: ReportKind;
  title: string | null;
  savedReportId: string | null;
  range: RangePreset;
  interval: ReportInterval;
  chart: ReportChart | null;
  spec: BuilderSpecModel | null;
  formula: string | null;
  text: string | null;
  layout: { x: number; y: number; w: number; h: number };
  hidden: boolean;
  /** The dashboard's one gold highlight (P19-05). */
  highlight?: boolean;
};

export type ReportDashboardModel = { id: string; name: string; sortOrder: number; cards: ReportCardModel[] };

export type SavedReportModel = { id: string; name: string; spec: BuilderSpecModel };

export type StoredLine = { a: string; m: string; c: string };

/** A money event as stored and synced: amounts are strings of kobo. */
export type StoredEvent = {
  type: EventType;
  date: string;
  lines: StoredLine[];
  reversalOf?: string;
  refundOf?: string;
  splitTotal?: string;
  payeeId?: string;
  notes?: string;
  /** Set on the new event of a correction (TECH-SPEC 6.3), so history shows both versions. */
  correctionOf?: string;
  /** Bookkeeping fields that change in place and never affect a figure (Q-16). */
  cleared?: boolean;
  reconciledBy?: string;
  importId?: string;
  goalId?: string;
  debtId?: string;
  recurringId?: string;
  incomeStreamId?: string;
  oneOff?: boolean;
  holdingId?: string;
  investment?: InvestmentMeta;
};

export type EventMeta = {
  payeeId?: string;
  correctionOf?: string;
  cleared?: boolean;
  reconciledBy?: string;
  importId?: string;
  goalId?: string;
  debtId?: string;
  recurringId?: string;
  incomeStreamId?: string;
  oneOff?: boolean;
};

export function toStored(e: Omit<MoneyEvent, 'id' | 'operationId' | 'status'> & EventMeta): StoredEvent {
  return {
    type: e.type,
    date: e.date,
    lines: e.lines.map((l) => ({ a: l.ledgerAccountId, m: l.amountMinor.toString(), c: l.currency })),
    reversalOf: e.reversalOf,
    refundOf: e.refundOf,
    splitTotal: e.splitTotal?.toString(),
    payeeId: e.payeeId,
    notes: e.notes,
    correctionOf: e.correctionOf,
    cleared: e.cleared,
    reconciledBy: e.reconciledBy,
    importId: e.importId,
    goalId: e.goalId,
    debtId: e.debtId,
    recurringId: e.recurringId,
    incomeStreamId: e.incomeStreamId,
    oneOff: e.oneOff,
    holdingId: e.holdingId,
    investment: e.investment,
  };
}

export function fromStored(id: string, operationId: string, s: StoredEvent, reversed: boolean): MoneyEvent & EventMeta {
  const lines: Line[] = s.lines.map((l) => ({ ledgerAccountId: l.a, amountMinor: BigInt(l.m), currency: l.c }));
  return {
    id,
    operationId,
    type: s.type,
    date: s.date,
    lines,
    status: reversed ? 'reversed' : 'posted',
    reversalOf: s.reversalOf,
    refundOf: s.refundOf,
    splitTotal: s.splitTotal === undefined ? undefined : BigInt(s.splitTotal),
    payeeId: s.payeeId,
    notes: s.notes,
    correctionOf: s.correctionOf,
    cleared: s.cleared,
    reconciledBy: s.reconciledBy,
    importId: s.importId,
    goalId: s.goalId,
    debtId: s.debtId,
    recurringId: s.recurringId,
    incomeStreamId: s.incomeStreamId,
    oneOff: s.oneOff,
    holdingId: s.holdingId,
    investment: s.investment,
  };
}

/** Income categories every workspace starts with, alongside the expense starters (Q-15). */
export const STARTER_INCOME: TextKey[] = ['cat.salary', 'cat.business', 'cat.gift', 'cat.otherIncome'];

/** One finished Reconcile (P10): the bank's balance is kept apart from what MyLedja worked out. */
export type Reconcile = {
  id: string;
  accountId: string;
  statementDate: string;
  statementBalance: string;
  calculatedBalance: string;
  adjustment: string;
  finishedAt: string;
};
