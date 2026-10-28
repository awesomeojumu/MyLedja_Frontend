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
};

export type Payee = {
  id: string;
  name: string;
  defaultCategoryId?: string;
  /** Bank import names that map here (P24-03). */
  aliases?: string[];
  deleted?: boolean;
};

export type BudgetStyle = 'tracking' | 'envelope';

/** Workspace preferences chosen in Welcome and Settings (Phase 1 subset). */
export type WorkspaceSettings = {
  budgetStyle: BudgetStyle;
  currency: string;
  weekStart: 'monday' | 'sunday' | 'saturday';
};

/** Planned amount for one category in one month, stored as kobo string. */
export type BudgetAssign = { categoryId: string; month: string; amountMinor: string };

export const budgetAssignId = (categoryId: string, month: string) => `${categoryId}:${month}`;

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
};

export type EventMeta = { payeeId?: string; correctionOf?: string; cleared?: boolean; reconciledBy?: string; importId?: string };

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
