import { formatUnits, parseUnits, pickLots, valueOf, type InvestmentMeta, type OpenLot } from './investments';
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
  if (!HOLDS_MONEY.has(a.kind) || a.holding) return fail('wrong_account_kind');
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

/**
 * E4 and E6: Dr the account money goes to, Cr the one it leaves. Exactly two lines.
 * E7 (two currencies): each side balances through fx-clearing; `toAmount` is required.
 */
export function buildTransfer(
  chart: Chart,
  input: { fromId: string; toId: string; amount: bigint; toAmount?: bigint },
): LedgerResult<Line[]> {
  if (input.amount <= 0n) return fail('not_positive');
  if (input.fromId === input.toId) return fail('transfer_accounts');
  const from = moneyAccount(chart, input.fromId);
  if (!from.ok) return from;
  const to = moneyAccount(chart, input.toId);
  if (!to.ok) return to;
  if (from.value.currency === to.value.currency) {
    if (input.toAmount !== undefined) return fail('currency_mismatch');
    return ok([line(to.value, input.amount), line(from.value, -input.amount)]);
  }
  if (input.toAmount === undefined || input.toAmount <= 0n) return fail('currency_mismatch');
  const fx = systemAccount(chart, 'fx_clearing');
  if (!fx.ok) return fx;
  return ok([
    { ledgerAccountId: fx.value.id, amountMinor: input.amount, currency: from.value.currency },
    line(from.value, -input.amount),
    line(to.value, input.toAmount),
    { ledgerAccountId: fx.value.id, amountMinor: -input.toAmount, currency: to.value.currency },
  ]);
}

/** E8: the amount is what you have (asset) or what you owe (liability), as a positive figure. */
export function buildOpeningBalance(chart: Chart, input: { accountId: string; amount: bigint }): LedgerResult<Line[]> {
  if (input.amount < 0n) return fail('not_positive');
  const account = moneyAccount(chart, input.accountId);
  if (!account.ok) return account;
  const equity = systemAccount(chart, 'opening_balances');
  if (!equity.ok) return equity;
  const debit = account.value.kind === 'asset' ? input.amount : -input.amount;
  return ok([line(account.value, debit), { ...line(equity.value, -debit), currency: account.value.currency }]);
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
  return ok([line(account.value, input.delta), { ...line(equity.value, -input.delta), currency: account.value.currency }]);
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
  const lines: Line[] = [line(payable.value, input.principal)];
  if (interest > 0n) {
    const charges = systemAccount(chart, 'interest_and_charges');
    if (!charges.ok) return charges;
    lines.push(line(charges.value, interest));
  }
  lines.push(line(account.value, -(input.principal + interest)));
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

/** E24: Dr take-home · Dr taxes · Dr pension · Dr NHF · Cr income (gross). Parts must add up to gross. */
export function buildSalaryGross(
  chart: Chart,
  input: {
    accountId: string;
    categoryId: string;
    gross: bigint;
    takeHome: bigint;
    paye: bigint;
    pensionAccountId: string;
    pension: bigint;
    nhfAccountId: string;
    nhf: bigint;
  },
): LedgerResult<Line[]> {
  if (input.gross <= 0n || input.takeHome <= 0n || input.paye < 0n || input.pension < 0n || input.nhf < 0n) {
    return fail('not_positive');
  }
  if (input.takeHome + input.paye + input.pension + input.nhf !== input.gross) return fail('split_mismatch');
  const cash = moneyAccount(chart, input.accountId);
  if (!cash.ok) return cash;
  const income = ofKind(chart, input.categoryId, 'income');
  if (!income.ok) return income;
  const pension = ofKind(chart, input.pensionAccountId, 'asset');
  if (!pension.ok) return pension;
  const nhf = ofKind(chart, input.nhfAccountId, 'asset');
  if (!nhf.ok) return nhf;
  const taxes = systemAccount(chart, 'taxes');
  if (!taxes.ok) return taxes;
  return ok([
    line(cash.value, input.takeHome),
    line(taxes.value, input.paye),
    line(pension.value, input.pension),
    line(nhf.value, input.nhf),
    line(income.value, -input.gross),
  ]);
}

function holdingAccount(chart: Chart, id: string): LedgerResult<LedgerAccount> {
  const a = chart.get(id);
  if (!a) return fail('unknown_account');
  if (!a.holding) return fail('wrong_account_kind');
  return ok(a);
}

export type BuiltInvestment = { lines: Line[]; investment: InvestmentMeta; type: 'investment_buy' | 'investment_sell' | 'income' };

/** E20: Dr holding (units × price + fees) · Cr cash. Buying isn't spending (case 15). */
export function buildBuy(
  chart: Chart,
  input: { holdingId: string; accountId: string; units: string; price: bigint; fees?: bigint },
): LedgerResult<BuiltInvestment> {
  if (input.price <= 0n || (input.fees ?? 0n) < 0n) return fail('not_positive');
  const holding = holdingAccount(chart, input.holdingId);
  if (!holding.ok) return holding;
  const cash = moneyAccount(chart, input.accountId);
  if (!cash.ok) return cash;
  if (cash.value.currency !== holding.value.currency) return fail('currency_mismatch');
  const units = parseUnitsSafe(input.units);
  if (units === null || units <= 0n) return fail('not_positive');
  const fees = input.fees ?? 0n;
  const cost = valueOf(units, input.price) + fees;
  return ok({
    type: 'investment_buy',
    lines: [line(holding.value, cost), line(cash.value, -cost)],
    investment: { kind: 'buy', units: input.units, price: input.price.toString(), fees: fees.toString() },
  });
}

/**
 * E21: Dr cash (proceeds after fees) · Cr holding (cost of the lots sold, oldest first unless chosen) ·
 * Cr Investment gain, or Dr Investment loss. Only the gain counts as income (case 17).
 */
export function buildSell(
  chart: Chart,
  input: {
    holdingId: string;
    accountId: string;
    units: string;
    price: bigint;
    fees?: bigint;
    open: readonly OpenLot[];
    lots?: readonly { lotId: string; units: string }[];
  },
): LedgerResult<BuiltInvestment & { gain: bigint }> {
  if (input.price <= 0n || (input.fees ?? 0n) < 0n) return fail('not_positive');
  const holding = holdingAccount(chart, input.holdingId);
  if (!holding.ok) return holding;
  const cash = moneyAccount(chart, input.accountId);
  if (!cash.ok) return cash;
  if (cash.value.currency !== holding.value.currency) return fail('currency_mismatch');
  const units = parseUnitsSafe(input.units);
  if (units === null || units <= 0n) return fail('not_positive');
  const held = input.open.reduce((s, l) => s + l.units, 0n);
  if (units > held) return fail('not_enough_units');
  const chosen = input.lots?.map((l) => ({ lotId: l.lotId, units: parseUnitsSafe(l.units) ?? -1n }));
  const picks = pickLots(input.open, units, chosen);
  if (!picks) return fail('lots_mismatch');
  const fees = input.fees ?? 0n;
  const proceeds = valueOf(units, input.price) - fees;
  if (proceeds <= 0n) return fail('fees_too_big');
  const cost = picks.reduce((s, p) => s + p.cost, 0n);
  const gain = proceeds - cost;
  const lines = [line(cash.value, proceeds), line(holding.value, -cost)];
  if (gain !== 0n) {
    const other = systemAccount(chart, gain > 0n ? 'investment_gain' : 'investment_loss');
    if (!other.ok) return other;
    lines.push({ ...line(other.value, -gain), currency: holding.value.currency });
  }
  return ok({
    type: 'investment_sell',
    gain,
    lines,
    investment: {
      kind: 'sell',
      units: input.units,
      price: input.price.toString(),
      fees: fees.toString(),
      lots: picks.map((p) => ({ lotId: p.lotId, units: formatUnits(p.units), cost: p.cost.toString() })),
    },
  });
}

/** E22: Dr cash, or Dr holding (a new lot) when reinvested · Cr Investment income. */
export function buildDividend(
  chart: Chart,
  input: { holdingId: string; amount: bigint; accountId?: string; reinvestedUnits?: string },
): LedgerResult<BuiltInvestment> {
  if (input.amount <= 0n) return fail('not_positive');
  const holding = holdingAccount(chart, input.holdingId);
  if (!holding.ok) return holding;
  const income = systemAccount(chart, 'investment_income');
  if (!income.ok) return income;
  if (input.reinvestedUnits) {
    const units = parseUnitsSafe(input.reinvestedUnits);
    if (units === null || units <= 0n) return fail('not_positive');
    return ok({
      type: 'income',
      lines: [line(holding.value, input.amount), { ...line(income.value, -input.amount), currency: holding.value.currency }],
      investment: { kind: 'reinvest', units: input.reinvestedUnits },
    });
  }
  if (!input.accountId) return fail('missing_lines');
  const cash = moneyAccount(chart, input.accountId);
  if (!cash.ok) return cash;
  if (cash.value.currency !== holding.value.currency) return fail('currency_mismatch');
  return ok({
    type: 'income',
    lines: [line(cash.value, input.amount), { ...line(income.value, -input.amount), currency: cash.value.currency }],
    investment: { kind: 'dividend' },
  });
}

function parseUnitsSafe(value: string): bigint | null {
  try {
    return parseUnits(value);
  } catch {
    return null;
  }
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
