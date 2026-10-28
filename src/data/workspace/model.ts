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
};

export type Category = {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  group: string;
  /** For starter categories, the catalogue key; the name follows the person's edits. */
  key?: TextKey;
  hidden: boolean;
  countInBudget: boolean;
};

export type Payee = { id: string; name: string; defaultCategoryId?: string };

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
};

export function toStored(e: Omit<MoneyEvent, 'id' | 'operationId' | 'status'> & { payeeId?: string }): StoredEvent {
  return {
    type: e.type,
    date: e.date,
    lines: e.lines.map((l) => ({ a: l.ledgerAccountId, m: l.amountMinor.toString(), c: l.currency })),
    reversalOf: e.reversalOf,
    refundOf: e.refundOf,
    splitTotal: e.splitTotal?.toString(),
    payeeId: e.payeeId,
    notes: e.notes,
  };
}

export function fromStored(id: string, operationId: string, s: StoredEvent, reversed: boolean): MoneyEvent & { payeeId?: string } {
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
  };
}

/** Income categories every workspace starts with, alongside the expense starters (Q-15). */
export const STARTER_INCOME: TextKey[] = ['cat.salary', 'cat.business', 'cat.gift', 'cat.otherIncome'];
