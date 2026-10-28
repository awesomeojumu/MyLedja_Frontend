import { fail, ok, type LedgerAccount, type LedgerResult, type Line, type MoneyEvent, type SystemAccount } from './types';

/** The workspace's ledger accounts, looked up by id or by system role. */
export class Chart {
  private readonly byId = new Map<string, LedgerAccount>();
  private readonly bySystem = new Map<SystemAccount, LedgerAccount>();

  constructor(accounts: LedgerAccount[]) {
    for (const a of accounts) {
      this.byId.set(a.id, a);
      if (a.system) this.bySystem.set(a.system, a);
    }
  }

  get(id: string): LedgerAccount | undefined {
    return this.byId.get(id);
  }

  system(key: SystemAccount): LedgerAccount | undefined {
    return this.bySystem.get(key);
  }

  all(): LedgerAccount[] {
    return [...this.byId.values()];
  }
}

const HOLDS_MONEY = new Set(['asset', 'liability']);

function line(account: LedgerAccount, amountMinor: bigint): Line {
  return { ledgerAccountId: account.id, amountMinor, currency: account.currency };
}

function moneyAccount(chart: Chart, id: string): LedgerResult<LedgerAccount> {
  const a = chart.get(id);
  if (!a) return fail('unknown_account');
  if (!HOLDS_MONEY.has(a.kind)) return fail('wrong_account_kind');
  return ok(a);
}

function ofKind(chart: Chart, id: string, kind: LedgerAccount['kind']): LedgerResult<LedgerAccount> {
  const a = chart.get(id);
  if (!a) return fail('unknown_account');
  if (a.kind !== kind) return fail('wrong_account_kind');
  return ok(a);
}

function systemAccount(chart: Chart, key: SystemAccount): LedgerResult<LedgerAccount> {
  const a = chart.system(key);
  return a ? ok(a) : fail('unknown_account');
}

/** E1: Dr account, Cr income category. */
export function buildIncome(chart: Chart, input: { accountId: string; categoryId: string; amount: bigint }): LedgerResult<Line[]> {
  if (input.amount <= 0n) return fail('not_positive');
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const category = ofKind(chart, input.categoryId, 'income');
  if (!category.ok) return category;
  return ok([line(account.value, input.amount), line(category.value, -input.amount)]);
}

export type ExpensePart = { categoryId: string; amount: bigint };

/** E2, E3, E5 and E12: Dr each expense category, Cr the bank or card. */
export function buildExpense(chart: Chart, input: { accountId: string; parts: ExpensePart[] }): LedgerResult<Line[]> {
  if (input.parts.length === 0) return fail('missing_lines');
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const lines: Line[] = [];
  let total = 0n;
  for (const part of input.parts) {
    if (part.amount <= 0n) return fail('not_positive');
    const category = ofKind(chart, part.categoryId, 'expense');
    if (!category.ok) return category;
    lines.push(line(category.value, part.amount));
    total += part.amount;
  }
  lines.push(line(account.value, -total));
  return ok(lines);
}

/** E4 and E6: Dr the account money goes to, Cr the one it leaves. Exactly two lines. */
export function buildTransfer(chart: Chart, input: { fromId: string; toId: string; amount: bigint }): LedgerResult<Line[]> {
  if (input.amount <= 0n) return fail('not_positive');
  if (input.fromId === input.toId) return fail('transfer_accounts');
  const from = moneyAccount(chart, input.fromId);
  if (!from.ok) return from;
  const to = moneyAccount(chart, input.toId);
  if (!to.ok) return to;
  if (from.value.currency !== to.value.currency) return fail('currency_mismatch');
  return ok([line(to.value, input.amount), line(from.value, -input.amount)]);
}

/** E8: the amount is what you have (asset) or what you owe (liability), as a positive figure. */
export function buildOpeningBalance(chart: Chart, input: { accountId: string; amount: bigint }): LedgerResult<Line[]> {
  if (input.amount < 0n) return fail('not_positive');
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const equity = systemAccount(chart, 'opening_balances');
  if (!equity.ok) return equity;
  const debit = account.value.kind === 'asset' ? input.amount : -input.amount;
  return ok([line(account.value, debit), line(equity.value, -debit)]);
}

/** E9 (reconcile, to Adjustments) and E10 (value update, to Revaluation). `delta` is the signed change in the ledger balance. */
export function buildAdjustment(
  chart: Chart,
  input: { accountId: string; delta: bigint; against: 'adjustments' | 'revaluation' },
): LedgerResult<Line[]> {
  if (input.delta === 0n) return fail('not_positive');
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const equity = systemAccount(chart, input.against);
  if (!equity.ok) return equity;
  return ok([line(account.value, input.delta), line(equity.value, -input.delta)]);
}

/** E11: Dr the account, Cr the original purchase's expense category. */
export function buildRefund(
  chart: Chart,
  input: { accountId: string; original: MoneyEvent; amount: bigint },
): LedgerResult<Line[]> {
  if (input.amount <= 0n) return fail('not_positive');
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const expenseLine = input.original.lines.find((l) => chart.get(l.ledgerAccountId)?.kind === 'expense');
  const category = expenseLine && chart.get(expenseLine.ledgerAccountId);
  if (!category) return fail('missing_lines');
  return ok([line(account.value, input.amount), line(category, -input.amount)]);
}

/** E15: Dr receivable · Cr bank. */
export function buildLend(chart: Chart, input: { receivableId: string; accountId: string; amount: bigint }): LedgerResult<Line[]> {
  if (input.amount <= 0n) return fail('not_positive');
  const receivable = ofKind(chart, input.receivableId, 'asset');
  if (!receivable.ok) return receivable;
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  return ok([line(receivable.value, input.amount), line(account.value, -input.amount)]);
}

/** E13 (person): Dr bank · Cr payable. */
export function buildLoanProceeds(chart: Chart, input: { payableId: string; accountId: string; amount: bigint }): LedgerResult<Line[]> {
  if (input.amount <= 0n) return fail('not_positive');
  const payable = ofKind(chart, input.payableId, 'liability');
  if (!payable.ok) return payable;
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  return ok([line(account.value, input.amount), line(payable.value, -input.amount)]);
}

/** E16: Dr bank · Cr receivable · Cr interest (optional). */
export function buildCollect(
  chart: Chart,
  input: { receivableId: string; accountId: string; principal: bigint; interest?: bigint },
): LedgerResult<Line[]> {
  if (input.principal <= 0n) return fail('not_positive');
  const receivable = ofKind(chart, input.receivableId, 'asset');
  if (!receivable.ok) return receivable;
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const interest = input.interest ?? 0n;
  if (interest < 0n) return fail('not_positive');
  const lines: Line[] = [line(account.value, input.principal + interest), line(receivable.value, -input.principal)];
  if (interest > 0n) {
    const earned = systemAccount(chart, 'interest_earned');
    if (!earned.ok) return earned;
    lines.push(line(earned.value, -interest));
  }
  return ok(lines);
}

/** E14 (person): Dr payable · Dr interest expense · Cr bank. */
export function buildLoanRepayment(
  chart: Chart,
  input: { payableId: string; accountId: string; principal: bigint; interest?: bigint },
): LedgerResult<Line[]> {
  if (input.principal <= 0n) return fail('not_positive');
  const payable = ofKind(chart, input.payableId, 'liability');
  if (!payable.ok) return payable;
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const interest = input.interest ?? 0n;
  if (interest < 0n) return fail('not_positive');
  const lines: Line[] = [line(payable.value, input.principal), line(account.value, -(input.principal + interest))];
  if (interest > 0n) {
    const charges = systemAccount(chart, 'interest_and_charges');
    if (!charges.ok) return charges;
    lines.push(line(charges.value, interest));
  }
  return ok(lines);
}

/** E17: Dr written off · Cr receivable. */
export function buildWriteOff(chart: Chart, input: { receivableId: string; amount: bigint }): LedgerResult<Line[]> {
  if (input.amount <= 0n) return fail('not_positive');
  const receivable = ofKind(chart, input.receivableId, 'asset');
  if (!receivable.ok) return receivable;
  const loss = systemAccount(chart, 'written_off');
  if (!loss.ok) return loss;
  return ok([line(loss.value, input.amount), line(receivable.value, -input.amount)]);
}

/** E25: the original's lines with every sign flipped. */
export function buildReversal(original: MoneyEvent): Line[] {
  return original.lines.map((l) => ({ ...l, amountMinor: -l.amountMinor }));
}

/** E9 amount for Reconcile: what the statement says minus what MyLedja says, as a change to the shown balance. */
export function reconcileDelta(account: LedgerAccount, statement: bigint, shown: bigint): bigint {
  const difference = statement - shown;
  return account.kind === 'liability' ? -difference : difference;
}
