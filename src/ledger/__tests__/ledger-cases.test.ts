import cases from '../../../test/fixtures/ledger-cases.json';
import {
  barState,
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
  buildSalaryGross,
  buildTransfer,
  buildWriteOff,
  costOfPurchase,
  categoryActivity,
  Chart,
  envelopeBudget,
  Journal,
  ledgerBalance,
  monthIncome,
  monthSpent,
  netWorth,
  periodTotals,
  shownBalance,
  systemAccounts,
  type LedgerAccount,
  type LedgerKind,
  type LedgerResult,
  type Line,
  type NewEvent,
} from '..';

type LineSpec = { account: string; amount: string };
type CaseStep = {
  ref?: string;
  operation?: string;
  post?: Record<string, unknown>;
  /** BE case 16: set a holding price without a ledger event. */
  price?: { holdingId: string; price: string; date: string };
  correct?: string;
  input?: Record<string, unknown>;
  expectLines?: LineSpec[];
  expectReversalLines?: LineSpec[];
  expectError?: { status: number; code: string; message: string };
  expectDuplicateOf?: string;
};
type LedgerCase = {
  id: number;
  title: string;
  steps: CaseStep[];
  budget?: { style: string; months: string[]; assigned: Record<string, Record<string, string>> };
  holdingsMark?: { account: string; units: string; pricePerUnit: string }[];
  /** BE: naira per unit of each other currency as a string (e.g. USD: "1550"). */
  rates?: Record<string, string | { perUnit: string; unitMinor: string }>;
  expect: {
    balances?: Record<string, string>;
    months?: Record<string, { income: string; spent: string; spentByCategory: Record<string, string> }>;
    netWorth?: string;
    unrealised?: string | Record<string, string>;
    partialWithoutRate?: string[];
    withoutRates?: { netWorth: string; partial: string[] };
    eventCount?: number;
    statuses?: Record<string, string>;
    budget?: Record<
      string,
      { leftToPlan: string; overspentFromLastMonth: string; categories: Record<string, Record<string, string>> }
    >;
  };
};

const WS = 'ws';
const file = cases as unknown as {
  currency: string;
  accounts: { key: string; kind: string; accountType?: string; personDebt?: string; currency?: string }[];
  categories: { key: string; kind: string; budgetable?: boolean; system?: string }[];
  cases: LedgerCase[];
};

const big = (v: unknown) => BigInt(v as string);

function makeChart(): { chart: Chart; resolve: (token: string) => string } {
  const ids = new Map<string, string>();
  const own: LedgerAccount[] = [];
  for (const a of systemAccounts(WS, file.currency)) {
    ids.set(`system:${a.system}`, a.id);
    own.push(a);
  }
  for (const a of file.accounts) {
    ids.set(a.key, a.key);
    own.push({
      id: a.key,
      kind: a.kind as LedgerKind,
      name: a.key,
      currency: a.currency ?? file.currency,
    });
  }
  for (const c of file.categories) {
    if (c.system) {
      const systemId = ids.get(`system:${c.system}`)!;
      ids.set(c.key, systemId);
      const existing = own.find((a) => a.id === systemId);
      if (existing) existing.categoryId = c.key;
      continue;
    }
    ids.set(c.key, c.key);
    own.push({
      id: c.key,
      kind: c.kind as LedgerKind,
      name: c.key,
      currency: file.currency,
      categoryId: c.key,
      countInBudget: c.budgetable !== false,
    });
  }
  const resolve = (token: string) => {
    if (token.startsWith('@')) {
      const key = token.slice(1);
      const id = ids.get(key);
      if (!id) throw new Error(`unknown ${token}`);
      return id;
    }
    return token;
  };
  return { chart: new Chart(own), resolve };
}

function bindPost(raw: Record<string, unknown>, resolve: (t: string) => string, events: Map<string, string>): Record<string, unknown> {
  const swap = (v: unknown, field: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => swap(x, field));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, swap(x, k)]));
    if (typeof v !== 'string') return v;
    if (v.startsWith('#')) return events.get(v.slice(1)) ?? v;
    if (v.startsWith('@')) return resolve(v);
    return v;
  };
  return swap(raw, '') as Record<string, unknown>;
}

function linesFor(
  chart: Chart,
  journal: Journal,
  resolve: (t: string) => string,
  events: Map<string, string>,
  post: Record<string, unknown>,
): LedgerResult<Line[]> {
  const input = bindPost(post, resolve, events);
  const type = input.type as string;
  switch (type) {
    case 'income':
      return buildIncome(chart, { accountId: input.accountId as string, categoryId: input.categoryId as string, amount: big(input.amount) });
    case 'expense': {
      const parts =
        (input.splits as { categoryId: string; amount: string }[] | undefined)?.map((p) => ({
          categoryId: p.categoryId,
          amount: big(p.amount),
        })) ?? [{ categoryId: input.categoryId as string, amount: big(input.amount) }];
      return buildExpense(chart, { accountId: input.accountId as string, parts });
    }
    case 'transfer':
      return buildTransfer(chart, {
        fromId: input.fromAccountId as string,
        toId: input.toAccountId as string,
        amount: big(input.amount),
        toAmount: input.toAmount !== undefined ? big(input.toAmount) : undefined,
      });
    case 'opening_balance':
      return buildOpeningBalance(chart, { accountId: input.accountId as string, amount: big(input.amount) });
    case 'balance_adjustment':
      return buildAdjustment(chart, {
        accountId: input.accountId as string,
        delta: big(input.amount),
        against: (input.reason as string) === 'revalue' ? 'revaluation' : 'adjustments',
      });
    case 'refund':
      return buildRefund(chart, {
        accountId: input.accountId as string,
        original: journal.get(input.refundOf as string)!,
        amount: big(input.amount),
      });
    case 'loan_proceeds':
      return buildLoanProceeds(chart, {
        payableId: input.loanAccountId as string,
        accountId: input.accountId as string,
        amount: big(input.amount),
      });
    case 'loan_repayment':
      return buildLoanRepayment(chart, {
        payableId: input.loanAccountId as string,
        accountId: input.accountId as string,
        principal: big(input.principal),
        interest: input.interest !== undefined ? big(input.interest) : 0n,
      });
    case 'lend':
      return buildLend(chart, {
        receivableId: input.receivableAccountId as string,
        accountId: input.accountId as string,
        amount: big(input.amount),
      });
    case 'collect':
      return buildCollect(chart, {
        receivableId: input.receivableAccountId as string,
        accountId: input.accountId as string,
        principal: big(input.principal),
        interest: input.interest !== undefined ? big(input.interest) : 0n,
      });
    case 'write_off':
      return buildWriteOff(chart, { receivableId: input.receivableAccountId as string, amount: big(input.amount) });
    case 'salary_gross':
      return buildSalaryGross(chart, {
        accountId: input.accountId as string,
        categoryId: input.categoryId as string,
        gross: big(input.gross),
        takeHome: big(input.takeHome),
        paye: big(input.paye),
        pensionAccountId: input.pensionAccountId as string,
        pension: big(input.pension),
        nhfAccountId: input.nhfAccountId as string,
        nhf: big(input.nhf),
      });
    case 'investment_buy':
      return buildInvestmentBuy(chart, {
        holdingAccountId: (input.holdingAccountId ?? input.holdingId) as string,
        cashAccountId: (input.cashAccountId ?? input.accountId) as string,
        units: input.units as string,
        pricePerUnit: big(input.pricePerUnit ?? input.price),
        fees: input.fees !== undefined ? big(input.fees) : 0n,
      });
    case 'investment_sell':
      return buildInvestmentSell(chart, {
        holdingAccountId: (input.holdingAccountId ?? input.holdingId) as string,
        cashAccountId: (input.cashAccountId ?? input.accountId) as string,
        units: input.units as string,
        pricePerUnit: big(input.pricePerUnit ?? input.price),
        fees: input.fees !== undefined ? big(input.fees) : 0n,
        costOfLots: big(input.costOfLots),
      });
    default:
      throw new Error(`Unknown post type ${type}`);
  }
}

type LotBook = { units: number; cost: bigint; remaining: number };

function fifoCostOf(lots: LotBook[], units: number): bigint {
  let left = units;
  let cost = 0n;
  for (const lot of lots) {
    if (lot.remaining <= 0 || left <= 0) continue;
    const take = Math.min(lot.remaining, left);
    cost += (lot.cost * BigInt(Math.round(take * 1e6))) / BigInt(Math.round(lot.units * 1e6));
    lot.remaining -= take;
    left -= take;
  }
  return cost;
}

function keyOfLine(chart: Chart, resolve: (t: string) => string, ledgerAccountId: string): string {
  for (const a of file.accounts) if (a.key === ledgerAccountId) return `@${a.key}`;
  for (const c of file.categories) if (resolve(`@${c.key}`) === ledgerAccountId) return `@${c.key}`;
  const account = chart.get(ledgerAccountId);
  if (account?.system) return `@system:${account.system}`;
  return ledgerAccountId;
}

function run(c: LedgerCase) {
  const { chart, resolve } = makeChart();
  let n = 0;
  const journal = new Journal(chart, [], () => `id-${++n}`);
  const events = new Map<string, string>();
  const lots = new Map<string, LotBook[]>();
  const marks = new Map<string, { units: string; pricePerUnit: string }>();
  for (const step of c.steps) {
    const operationId = step.operation ? `case-${c.id}-${step.operation}` : `op-${c.id}-${step.ref ?? n + 1}`;
    if (step.correct) {
      const input = bindPost(step.input!, resolve, events);
      const built = linesFor(chart, journal, resolve, events, step.input!);
      if (!built.ok) throw new Error(built.error);
      const result = journal.correct(events.get(step.correct.slice(1))!, `${operationId}-reversal`, {
        operationId,
        type: input.type as NewEvent['type'],
        date: input.date as string,
        lines: built.value,
      });
      if (!result.ok) throw new Error(result.error);
      if (step.expectReversalLines) {
        expect(
          result.value.reversal.lines.map((l) => ({
            account: keyOfLine(chart, resolve, l.ledgerAccountId),
            amount: l.amountMinor.toString(),
          })),
        ).toEqual(step.expectReversalLines);
      }
      if (step.expectLines) {
        expect(
          result.value.event.lines.map((l) => ({
            account: keyOfLine(chart, resolve, l.ledgerAccountId),
            amount: l.amountMinor.toString(),
          })),
        ).toEqual(step.expectLines);
      }
      if (step.ref) events.set(step.ref, result.value.event.id);
      continue;
    }
    if (step.price) {
      const holdingId = bindPost(step.price as unknown as Record<string, unknown>, resolve, events).holdingId as string;
      const openUnits = (lots.get(holdingId) ?? []).reduce((s, l) => s + l.remaining, 0);
      marks.set(holdingId, { units: String(openUnits), pricePerUnit: step.price.price });
      continue;
    }
    if (!step.post) throw new Error(`case ${c.id}: step needs post, price or correct`);
    const bound = bindPost(step.post, resolve, events);
    let post = step.post;
    if (bound.type === 'investment_sell' && bound.costOfLots === undefined) {
      const holdingId = (bound.holdingId ?? bound.holdingAccountId) as string;
      const cost = fifoCostOf(lots.get(holdingId) ?? [], Number(bound.units));
      post = { ...step.post, costOfLots: cost.toString() };
    }
    const built = linesFor(chart, journal, resolve, events, post);
    const posted = built.ok
      ? journal.post({
          operationId,
          type: bound.type as NewEvent['type'],
          date: bound.date as string,
          lines: built.value,
          refundOf: bound.type === 'refund' ? (bound.refundOf as string) : undefined,
          splitTotal: Array.isArray(bound.splits) && bound.amount !== undefined ? big(bound.amount) : undefined,
        })
      : built;

    if (step.expectError) {
      expect(posted.ok).toBe(false);
      if (!posted.ok) {
        const code = step.expectError.code === 'refund_too_big' ? 'refund_too_large' : step.expectError.code;
        expect(posted.error).toBe(code);
      }
      continue;
    }
    if (!posted.ok) throw new Error(`${step.ref ?? c.id}: ${posted.error}`);
    if (step.expectDuplicateOf) {
      expect(posted.value.status).toBe('duplicate');
      expect(posted.value.event.id).toBe(events.get(step.expectDuplicateOf.slice(1)));
    }
    if (step.expectLines && posted.value.status === 'applied') {
      expect(
        posted.value.event.lines.map((l) => ({
          account: keyOfLine(chart, resolve, l.ledgerAccountId),
          amount: l.amountMinor.toString(),
        })),
      ).toEqual(step.expectLines);
    }
    if (posted.value.status === 'applied' && bound.type === 'investment_buy') {
      const holdingId = (bound.holdingId ?? bound.holdingAccountId) as string;
      const units = Number(bound.units);
      const cost = posted.value.event.lines.find((l) => l.ledgerAccountId === holdingId)?.amountMinor ?? 0n;
      const book = lots.get(holdingId) ?? [];
      book.push({ units, cost, remaining: units });
      lots.set(holdingId, book);
    }
    if (step.ref) events.set(step.ref, posted.value.event.id);
  }
  return { chart, journal, events, resolve, marks };
}

describe('ledger-cases.json (TECH-SPEC 6.14)', () => {
  it.each(file.cases.map((c) => [c.id, c.title, c] as const))('case %s: %s', (_n, _title, c) => {
    const { chart, journal, events, resolve, marks } = run(c);
    const all = journal.list();
    const totals = periodTotals(all);
    const e = c.expect;

    for (const [key, value] of Object.entries(e.balances ?? {})) {
      const account = chart.get(resolve(`@${key}`))!;
      expect([key, shownBalance(account, ledgerBalance(account.id, all)).toString()]).toEqual([key, value]);
    }
    for (const [month, want] of Object.entries(e.months ?? {})) {
      const spentByCategory: Record<string, string> = {};
      for (const cat of file.categories.filter((x) => x.kind === 'expense')) {
        const v = categoryActivity(totals, month, resolve(`@${cat.key}`));
        if (v !== 0n) spentByCategory[cat.key] = v.toString();
      }
      expect({
        income: monthIncome(chart, totals, month).toString(),
        spent: monthSpent(chart, totals, month).toString(),
        spentByCategory,
      }).toEqual(want);
    }
    let unrealised = 0n;
    const unrealisedBy: Record<string, string> = {};
    for (const mark of c.holdingsMark ?? []) {
      const account = chart.get(resolve(`@${mark.account}`))!;
      const cost = shownBalance(account, ledgerBalance(account.id, all));
      const u = costOfPurchase(mark.units, BigInt(mark.pricePerUnit), 0n) - cost;
      unrealised += u;
      unrealisedBy[mark.account] = u.toString();
    }
    for (const [holdingId, mark] of marks) {
      const account = chart.get(holdingId)!;
      const cost = shownBalance(account, ledgerBalance(account.id, all));
      const u = costOfPurchase(mark.units, BigInt(mark.pricePerUnit), 0n) - cost;
      unrealised += u;
      const key = file.accounts.find((a) => resolve(`@${a.key}`) === holdingId)?.key ?? holdingId;
      unrealisedBy[key] = u.toString();
    }
    if (e.unrealised !== undefined) {
      if (typeof e.unrealised === 'string') expect(unrealised.toString()).toBe(e.unrealised);
      else expect(unrealisedBy).toEqual(e.unrealised);
    }
    if (e.partialWithoutRate) {
      expect(netWorth(chart, all, '2026-12-31').partial).toEqual(e.partialWithoutRate);
    }
    const toRates = (raw: Record<string, string | { perUnit: string; unitMinor: string }> | undefined) => {
      const rates: Record<string, { numerator: bigint; denominator: bigint }> = {};
      for (const [ccy, rate] of Object.entries(raw ?? {})) {
        if (typeof rate === 'string') {
          // BE: naira per 1 major foreign unit; FE balances are already in minor units of that currency.
          rates[ccy] = { numerator: BigInt(rate), denominator: 1n };
        } else {
          rates[ccy] = { numerator: BigInt(rate.perUnit), denominator: BigInt(rate.unitMinor) };
        }
      }
      return rates;
    };
    if (e.netWorth !== undefined) {
      expect((netWorth(chart, all, '2026-12-31', toRates(c.rates)).total + unrealised).toString()).toBe(e.netWorth);
    }
    if (e.withoutRates) {
      const w = netWorth(chart, all, '2026-12-31', {});
      expect({ netWorth: (w.total + unrealised).toString(), partial: w.partial }).toEqual(e.withoutRates);
    }
    if (e.eventCount !== undefined) expect(all).toHaveLength(e.eventCount);
    for (const [ref, status] of Object.entries(e.statuses ?? {})) {
      expect(journal.get(events.get(ref)!)!.status).toBe(status);
    }

    if (c.budget && e.budget) {
      const budgetable = new Set(file.categories.filter((x) => x.budgetable).map((x) => resolve(`@${x.key}`)));
      const months = envelopeBudget({
        months: c.budget.months,
        categories: Object.keys(Object.values(c.budget.assigned)[0] ?? {}).map((ledgerAccountId) => ({ ledgerAccountId })),
        assigned: (cat, m) => BigInt(c.budget!.assigned[m]?.[cat] ?? '0'),
        activity: (cat, m) => categoryActivity(totals, m, resolve(`@${cat}`)),
        budgetableIncome: (m) => {
          let sum = 0n;
          for (const [id, amount] of totals.get(m) ?? []) {
            const account = chart.get(id);
            if (account?.kind === 'income' && budgetable.has(id)) sum += -amount;
          }
          return sum;
        },
      });
      for (const bm of months) {
        const want = e.budget[bm.month];
        if (!want) continue;
        const cats: Record<string, Record<string, string>> = {};
        for (const [key, row] of bm.rows) {
          const plan = row.assigned + row.carried;
          const state = barState(row.activity, plan);
          cats[key] = {
            carried: row.carried.toString(),
            assigned: row.assigned.toString(),
            activity: row.activity.toString(),
            available: row.available.toString(),
            state: state === 'over' ? 'over_plan' : state === 'near' ? 'near_limit' : 'within_plan',
          };
        }
        expect({
          leftToPlan: bm.leftToPlan.toString(),
          overspentFromLastMonth: bm.overspentFromLastMonth.toString(),
          categories: cats,
        }).toEqual(want);
      }
    }
  });
});
