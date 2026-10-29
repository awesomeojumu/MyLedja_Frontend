import type { TextKey } from '@/i18n';
import type { EventType, LedgerKind, Line, MoneyEvent } from '@/ledger';

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
  /** Archived while still holding a balance; still counts in net worth (PU-15). */
  closedWithBalance?: boolean;
  /** ISO date the account was opened / created (TB-03 Details). */
  openedAt?: string;
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
  /** Lucide icon name (PU-11). */
  icon?: string | null;
  /** Hide from the Budget page (P07-05). */
  hidden: boolean;
  countInBudget: boolean;
  order: number;
  budgetType: BudgetType;
  /** Tracking style: leftover carries when on (TECH-SPEC 6.6). */
  carryOver: boolean;
  /** Counts towards runway in Health (PU-11 / TECH-SPEC 6.10). */
  essential?: boolean;
  /** Soft-deleted after reassignment (Q-18); filtered out of the snapshot. */
  deleted?: boolean;
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

export type RuleConditionField =
  | 'payee'
  | 'description'
  | 'amount'
  | 'account'
  | 'category'
  | 'notes'
  | 'date'
  | 'money';

export type RuleConditionOp =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'isOneOf'
  | 'lessThan'
  | 'greaterThan'
  | 'between'
  | 'before'
  | 'after'
  | 'dayOfMonth'
  | 'isIn'
  | 'isOut'
  | 'isEmpty';

export type RuleCondition = { field: RuleConditionField; op: RuleConditionOp; value: string };

export type RuleActionKind = 'setCategory' | 'renamePayee' | 'addNote' | 'addTag' | 'split' | 'linkSchedule' | 'moneyBack';

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

/** Phase 5 investments (TECH-SPEC 6.8 / PU-37…40). */
export const HOLDING_TYPES = ['stock', 'fund', 'pension', 'crypto', 'fixedDeposit', 'other'] as const;
export type HoldingType = (typeof HOLDING_TYPES)[number];

export type Holding = {
  id: string;
  name: string;
  symbol?: string;
  type: HoldingType;
  /** Parent investment account (Held in). */
  accountId: string;
  currency: string;
  /** Ledger asset for this holding's cost basis. */
  ledgerAccountId: string;
};

export type HoldingLot = {
  id: string;
  holdingId: string;
  date: string;
  units: string;
  /** Units already sold from this lot. */
  soldUnits: string;
  /** Total cost of the original lot in minor units. */
  costMinor: string;
  pricePerUnitMinor: string;
  feesMinor: string;
  buyEventId?: string;
};

export type HoldingPrice = {
  id: string;
  holdingId: string;
  date: string;
  priceMinor: string;
};

/** Reports dashboards (PU-41…43 / TB-10). */
export type ReportCardKind =
  | 'spendingByCategory'
  | 'incomeVsSpending'
  | 'netWorth'
  | 'cashFlow'
  | 'budgetProgress'
  | 'custom';

export type ReportCard = {
  id: string;
  kind: ReportCardKind;
  title: string;
  hidden?: boolean;
};

export type ReportDashboard = {
  id: string;
  name: string;
  cards: ReportCard[];
  order: number;
};

export type SavedReport = {
  id: string;
  name: string;
  kind: ReportCardKind;
  dashboardId?: string;
};

/** Health settings (PU-44 / TECH-SPEC 6.10). Matches BE `HealthSettings`. */
export type HealthSettings = {
  /** Null/omit = bank, cash, wallet and savings (TECH-SPEC 6.10). */
  cashAccountIds?: string[] | null;
  targetMonths: 3 | 6 | 12;
  countInvestments: boolean;
};

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = { targetMonths: 6, countInvestments: false };

/** Read pops-stub or BE-shaped health settings into the TECH-SPEC shape. */
export function normalizeHealthSettings(raw: Partial<HealthSettings> & {
  emergencyMonths?: 3 | 6 | 12;
  countInvestmentsInRunway?: boolean;
  essentialCategoryIds?: string[];
} | null | undefined): HealthSettings {
  if (!raw) return { ...DEFAULT_HEALTH_SETTINGS };
  const target = raw.targetMonths ?? raw.emergencyMonths ?? 6;
  return {
    ...(raw.cashAccountIds !== undefined ? { cashAccountIds: raw.cashAccountIds } : {}),
    targetMonths: (target === 3 || target === 12 ? target : 6) as 3 | 6 | 12,
    countInvestments: raw.countInvestments ?? raw.countInvestmentsInRunway ?? false,
  };
}

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

/** Settings › Categories and tags — tag list (DESIGN page 26). */
export type WorkspaceTag = { id: string; name: string };

/** Workspace preferences chosen in Welcome and Settings (Phase 1 subset). */
export type WorkspaceSettings = {
  budgetStyle: BudgetStyle;
  currency: string;
  weekStart: 'monday' | 'sunday' | 'saturday';
  /** Workspace display name (TB-11 Workspace). */
  workspaceName?: string;
  /** Default Africa/Lagos (TB-11 Workspace). */
  timeZone?: string;
  checklistHidden?: boolean;
  /** Larger screens (tablet+); phone layout is `dashboardLayoutPhone` (PU-06). */
  dashboardLayout?: DashboardLayout;
  dashboardLayoutPhone?: DashboardLayout;
  notificationPrefs?: NotificationPrefs;
  aiPrefs?: AiFeaturePrefs;
  carryOverDefault?: boolean;
  budgetTypesShown?: BudgetTypesShown;
  exchangeRates?: ExchangeRateEntry[];
  downloadDailyRates?: boolean;
  deviceSync?: DeviceSyncPrefs;
  /** Profile photo (local URI); shows in sidebar/drawer (PU-63). */
  profilePhotoUri?: string | null;
  /** Phone haptics (Settings › General). */
  hapticsEnabled?: boolean;
  /** Tags managed under Categories and tags. */
  tags?: WorkspaceTag[];
  /** PU-28 — Due soon window in days (3 · 7 · 14 · 30). */
  dueSoonDays?: 3 | 7 | 14 | 30;
  health?: HealthSettings;
  reportDashboards?: ReportDashboard[];
  savedReports?: SavedReport[];
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
  icon?: string;
  notes?: string;
  targetMinor: string;
  targetDate?: string;
  accountId: string;
  categoryId?: string;
  status: 'active' | 'paused' | 'completed';
  completedAt?: string;
  /** Optional monthly schedule (P14-04 / PU-33). */
  scheduleAmountMinor?: string;
  scheduleDayOfMonth?: number;
  scheduleEvery?: 'week' | 'month';
  scheduleStarts?: string;
  /** When true, allocate on the day without asking (PU-33). */
  scheduleAutoAllocate?: boolean;
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
  /** Transfer destination (PU-25). */
  toAccountId?: string;
  categoryId?: string;
  payeeId?: string;
  rule: RecurrenceRule;
  startDate: string;
  endDate?: string;
  autoCreate?: boolean;
  /** DESIGN #25 — stop after this many occurrences (optional; endDate also ends the series). */
  endAfterCount?: number;
  /**
   * Days before due: 0 = on the day, 1, 3, or 7.
   * Omit / undefined = Off (PU-25 Remind me).
   */
  reminderDays?: number;
  /** DESIGN #25 — hide amount on lock screen (default on). */
  hideAmountOnLock?: boolean;
  /** Soft-deleted / cancelled schedule. */
  cancelled?: boolean;
  /** TB-04 / PU-25 — paused: shown as Paused, creates no reminders. */
  paused?: boolean;
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
  /** Source or employer (PU-29). */
  source?: string;
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
export type DebtInterest =
  | { kind: 'none' }
  | { kind: 'fixed'; amountMinor: string }
  | { kind: 'percent_month'; percent: number };

export type PersonDebt = {
  id: string;
  name: string;
  direction: DebtDirection;
  /** Ledger account id for R (asset) or P (liability). */
  ledgerAccountId: string;
  payeeId?: string;
  status: 'open' | 'settled' | 'written_off';
  nextDueDate?: string;
  notes?: string;
  interest?: DebtInterest;
  /** Credit kept after an overpayment (TECH-SPEC 6.9). */
  creditMinor?: string;
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
