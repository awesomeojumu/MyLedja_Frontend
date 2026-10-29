/** TECH-SPEC 6.1: the six kinds of ledger account. */
export type LedgerKind = 'asset' | 'liability' | 'income' | 'expense' | 'equity' | 'loss';

/** System accounts every workspace has (B1.1 / TECH-SPEC 6.1). */
export type SystemAccount =
  | 'opening_balances'
  | 'adjustments'
  | 'revaluation'
  | 'fx_clearing'
  | 'interest_earned'
  | 'investment_income'
  | 'investment_gain'
  | 'interest_and_charges'
  | 'fees'
  | 'taxes'
  | 'written_off'
  | 'investment_loss';

export type LedgerAccount = {
  id: string;
  kind: LedgerKind;
  name: string;
  currency: string;
  system?: SystemAccount;
  /** Set on income and expense accounts that stand for a budget category. */
  categoryId?: string;
  /** Income that counts toward the budget (TECH-SPEC 6.6). Defaults to true. */
  countInBudget?: boolean;
};

/** Positive is a debit, negative a credit (TECH-SPEC 6.1). */
export type Line = { ledgerAccountId: string; amountMinor: bigint; currency: string };

export type EventType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'opening_balance'
  | 'balance_adjustment'
  | 'refund'
  | 'reversal'
  | 'lend'
  | 'collect'
  | 'loan_proceeds'
  | 'loan_repayment'
  | 'write_off'
  | 'salary_gross'
  | 'investment_buy'
  | 'investment_sell';

export type EventStatus = 'pending' | 'posted' | 'reversed';

export type MoneyEvent = {
  id: string;
  operationId: string;
  type: EventType;
  /** A calendar day in the workspace's time zone, YYYY-MM-DD (TECH-SPEC 6.4). */
  date: string;
  lines: Line[];
  status: EventStatus;
  reversalOf?: string;
  reversedBy?: string;
  refundOf?: string;
  /** For a split, the total the parts must add up to. */
  splitTotal?: bigint;
  payeeName?: string;
  notes?: string;
};

export type LedgerErrorCode =
  | 'unbalanced'
  | 'unknown_account'
  | 'currency_mismatch'
  | 'missing_lines'
  | 'refund_too_large'
  | 'split_mismatch'
  | 'transfer_accounts'
  | 'already_reversed'
  | 'reconciled'
  | 'not_positive'
  | 'wrong_account_kind';

export type LedgerResult<T> = { ok: true; value: T } | { ok: false; error: LedgerErrorCode };

export const ok = <T>(value: T): LedgerResult<T> => ({ ok: true, value });
export const fail = <T = never>(error: LedgerErrorCode): LedgerResult<T> => ({ ok: false, error });
