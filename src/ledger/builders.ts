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

function line(account: LedgerAccount, amountMinor: bigint, currency = account.currency): Line {
  return { ledgerAccountId: account.id, amountMinor, currency };
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
  return ok([line(account.value, debit), line(equity.value, -debit, account.value.currency)]);
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
  return ok([line(account.value, input.delta), line(equity.value, -input.delta, account.value.currency)]);
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

/** Cost = units × price + fees, half away from zero (TECH-SPEC 6.5 / case 15). */
export function costOfPurchase(units: string, pricePerUnit: bigint, fees: bigint = 0n): bigint {
  const [whole, frac = ''] = units.split('.') as [string, string | undefined];
  const scale = 10n ** BigInt(frac.length);
  const unitMinor = BigInt(whole + frac);
  const num = unitMinor * pricePerUnit;
  const half = scale / 2n;
  const rounded = num >= 0n ? (num + half) / scale : -((-num + half) / scale);
  return rounded + fees;
}

/** E20: Dr holding · Cr cash. Never spending (case 15). */
export function buildInvestmentBuy(
  chart: Chart,
  input: { holdingAccountId: string; cashAccountId: string; units: string; pricePerUnit: bigint; fees?: bigint },
): LedgerResult<Line[]> {
  if (input.pricePerUnit <= 0n) return fail('not_positive');
  const fees = input.fees ?? 0n;
  if (fees < 0n) return fail('not_positive');
  const holding = moneyAccount(chart, input.holdingAccountId);
  if (!holding.ok) return holding;
  const cash = moneyAccount(chart, input.cashAccountId);
  if (!cash.ok) return cash;
  if (holding.value.id === cash.value.id) return fail('transfer_accounts');
  if (holding.value.currency !== cash.value.currency) return fail('currency_mismatch');
  const cost = costOfPurchase(input.units, input.pricePerUnit, fees);
  if (cost <= 0n) return fail('not_positive');
  return ok([line(holding.value, cost), line(cash.value, -cost)]);
}

/** E21: Dr cash · Cr holding (cost) · Cr gain or Dr loss (case 17). */
export function buildInvestmentSell(
  chart: Chart,
  input: {
    holdingAccountId: string;
    cashAccountId: string;
    units: string;
    pricePerUnit: bigint;
    fees?: bigint;
    costOfLots: bigint;
  },
): LedgerResult<Line[]> {
  if (input.pricePerUnit <= 0n || input.costOfLots <= 0n) return fail('not_positive');
  const fees = input.fees ?? 0n;
  if (fees < 0n) return fail('not_positive');
  const holding = moneyAccount(chart, input.holdingAccountId);
  if (!holding.ok) return holding;
  const cash = moneyAccount(chart, input.cashAccountId);
  if (!cash.ok) return cash;
  if (holding.value.id === cash.value.id) return fail('transfer_accounts');
  if (holding.value.currency !== cash.value.currency) return fail('currency_mismatch');
  const gross = costOfPurchase(input.units, input.pricePerUnit, 0n);
  const proceeds = gross > fees ? gross - fees : 0n;
  const lines: Line[] = [line(cash.value, proceeds), line(holding.value, -input.costOfLots)];
  const diff = proceeds - input.costOfLots;
  if (diff > 0n) {
    const gain = systemAccount(chart, 'investment_gain');
    if (!gain.ok) return gain;
    lines.push(line(gain.value, -diff));
  } else if (diff < 0n) {
    const loss = systemAccount(chart, 'investment_loss');
    if (!loss.ok) return loss;
    lines.push(line(loss.value, -diff));
  }
  return ok(lines);
}

/** Unrealised gain = market − remaining cost (TECH-SPEC 6.8 / case 16). Never income. */
export function unrealisedGain(units: string, pricePerUnit: bigint, costBasis: bigint): bigint {
  return costOfPurchase(units, pricePerUnit, 0n) - costBasis;
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

/** E25: the original's lines with every sign flipped. */
export function buildReversal(original: MoneyEvent): Line[] {
  return original.lines.map((l) => ({ ...l, amountMinor: -l.amountMinor }));
}

/** E9 amount for Reconcile: what the statement says minus what MyLedja says, as a change to the shown balance. */
export function reconcileDelta(account: LedgerAccount, statement: bigint, shown: bigint): bigint {
  const difference = statement - shown;
  return account.kind === 'liability' ? -difference : difference;
}
