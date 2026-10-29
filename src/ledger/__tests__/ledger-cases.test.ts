import cases from '../../../test/fixtures/ledger-cases.json';
import {
  barState,
  buildAdjustment,
  buildBuy,
  buildCollect,
  buildDividend,
  buildExpense,
  buildIncome,
  buildLend,
  buildLoanProceeds,
  buildLoanRepayment,
  buildOpeningBalance,
  buildRefund,
  buildSalaryGross,
  buildSell,
  buildTransfer,
  converterOf,
  lotsFrom,
  position,
  buildWriteOff,
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
  type InvestmentMeta,
  type NewEvent,
  type Price,
} from '..';

type LineSpec = { account: string; amount: string };
type CaseStep = {
  ref?: string;
  operation?: string;
  post?: Record<string, unknown>;
  correct?: string;
  price?: { holdingId: string; price: string; date: string };
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
  rates?: Record<string, string>;
  budget?: { style: string; months: string[]; assigned: Record<string, Record<string, string>> };
  expect: {
    balances?: Record<string, string>;
    months?: Record<string, { income: string; spent: string; spentByCategory: Record<string, string> }>;
    netWorth?: string;
    unrealised?: Record<string, string>;
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
  accounts: { key: string; kind: string; accountType?: string; personDebt?: string; currency?: string; holdingOf?: string }[];
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
      holding: a.holdingOf ? true : undefined,
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
  const built = buildFor(chart, journal, resolve, events, post);
  return built.ok ? { ok: true, value: built.value.lines } : built;
}

type Built = { lines: Line[]; type?: NewEvent['type']; investment?: InvestmentMeta; holdingId?: string };

const lotsOfJournal = (journal: Journal) =>
  lotsFrom(journal.list().map((e) => ({ ...e, holdingId: e.holdingId ?? null, investment: e.investment ?? null })));

function buildFor(
  chart: Chart,
  journal: Journal,
  resolve: (t: string) => string,
  events: Map<string, string>,
  post: Record<string, unknown>,
): LedgerResult<Built> {
  const input = bindPost(post, resolve, events);
  const type = input.type as string;
  const wrap = (r: LedgerResult<Line[]>): LedgerResult<Built> => (r.ok ? { ok: true, value: { lines: r.value } } : r);
  switch (type) {
    case 'investment_buy': {
      const r = buildBuy(chart, {
        holdingId: input.holdingId as string,
        accountId: input.accountId as string,
        units: input.units as string,
        price: big(input.price),
        fees: input.fees !== undefined ? big(input.fees) : 0n,
      });
      return r.ok ? { ok: true, value: { ...r.value, holdingId: input.holdingId as string } } : r;
    }
    case 'investment_sell': {
      const open = (lotsOfJournal(journal).get(input.holdingId as string) ?? []).filter((l) => l.units > 0n);
      const r = buildSell(chart, {
        holdingId: input.holdingId as string,
        accountId: input.accountId as string,
        units: input.units as string,
        price: big(input.price),
        fees: input.fees !== undefined ? big(input.fees) : 0n,
        open,
      });
      return r.ok ? { ok: true, value: { ...r.value, holdingId: input.holdingId as string } } : r;
    }
    case 'dividend': {
      const r = buildDividend(chart, {
        holdingId: input.holdingId as string,
        amount: big(input.amount),
        accountId: input.accountId as string | undefined,
        reinvestedUnits: input.reinvestedUnits as string | undefined,
      });
      return r.ok ? { ok: true, value: { ...r.value, holdingId: input.holdingId as string } } : r;
    }
  }
  return wrap(linesForBasic(chart, journal, resolve, events, post));
}

function linesForBasic(
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
    default:
      throw new Error(`Unknown post type ${type}`);
  }
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
  const prices: Price[] = [];
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
      prices.push({ holdingId: resolve(step.price.holdingId), date: step.price.date, priceMinor: big(step.price.price) });
      continue;
    }
    if (!step.post) throw new Error(`case ${c.id}: step needs post or correct`);
    const built = buildFor(chart, journal, resolve, events, step.post);
    const posted = built.ok
      ? journal.post({
          operationId,
          type: built.value.type ?? (bindPost(step.post, resolve, events).type as NewEvent['type']),
          date: bindPost(step.post, resolve, events).date as string,
          lines: built.value.lines,
          holdingId: built.value.holdingId,
          investment: built.value.investment,
          refundOf: step.post.type === 'refund' ? (bindPost(step.post, resolve, events).refundOf as string) : undefined,
          splitTotal:
            Array.isArray(step.post.splits) && step.post.amount !== undefined ? big(step.post.amount) : undefined,
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
    if (step.ref) events.set(step.ref, posted.value.event.id);
  }
  return { chart, journal, events, resolve, prices };
}

describe('ledger-cases.json (TECH-SPEC 6.14)', () => {
  it.each(file.cases.map((c) => [c.id, c.title, c] as const))('case %s: %s', (_n, _title, c) => {
    const { chart, journal, events, resolve, prices } = run(c);
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
    const lots = lotsOfJournal(journal);
    let unrealised = 0n;
    for (const a of file.accounts.filter((x) => x.holdingOf)) {
      const p = position(lots.get(a.key) ?? [], prices, a.key, '9999-12-31');
      unrealised += p.unrealised;
      if (e.unrealised?.[a.key] !== undefined) expect([a.key, p.unrealised.toString()]).toEqual([a.key, e.unrealised[a.key]]);
    }
    const convert = converterOf(
      Object.entries(c.rates ?? {}).map(([currency, rate]) => ({ currency, rate, date: '0000-01-01' })),
      file.currency,
    );
    if (e.netWorth !== undefined) {
      expect((netWorth(chart, all, '2026-12-31', convert).total + unrealised).toString()).toBe(e.netWorth);
    }
    if (e.withoutRates) {
      const w = netWorth(chart, all, '2026-12-31');
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
