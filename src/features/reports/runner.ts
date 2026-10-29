import type {
  BuilderSpecModel,
  RangePreset,
  ReportChart,
  ReportFiltersModel,
  ReportInterval,
  ReportKind,
} from '@/data/workspace/model';
import { ACCOUNT_KIND_INFO } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { budgetForMonth } from '@/features/budget/helpers';
import { incomeForMonth } from '@/features/income/helpers';
import { converterFor, holdingRows, wealthAt } from '@/features/investments/helpers';
import { dueDatesInMonth } from '@/features/plan/recurrence';
import { evaluate, FormulaError } from '@/ledger/formula';
import {
  ageOfMoney,
  bucketsBetween,
  cashFlow,
  changeBasisPoints,
  previousRange,
  run,
  type CashFlowBand,
  type Dimension,
  type Fact,
  type Filters,
  type Lookup,
  type Spec,
  type Table,
} from '@/ledger/reports';
import { catalogue, t, type TextKey } from '@/i18n';
import { roundHalfAwayFromZero } from '@/money';

/**
 * Reports on the device (DESIGN.md pages 19 to 21): the same engine as the server's (TECH-SPEC 6.12), fed
 * from this device's copy of the workspace, so reports work offline.
 */

export type ReportInput = {
  kind: ReportKind;
  from: string;
  to: string;
  interval: ReportInterval;
  compare?: boolean;
  filters?: ReportFiltersModel;
  spec?: BuilderSpecModel | null;
  formula?: string | null;
  monthsAhead?: number;
};

export type Finding = { key: string; amount: bigint | null; changeBasisPoints: bigint | null; previousFrom: string | null };

export type ReportResult = {
  kind: ReportKind;
  range: { from: string; to: string };
  chart: ReportChart;
  unit: 'money' | 'count' | 'days' | 'basis_points';
  table: Table;
  previous: Table | null;
  finding: Finding | null;
  /** For each row key: the Transactions filters behind it (P20-03). */
  drill: Record<string, { from: string; to: string; accountId?: string; categoryId?: string; payeeId?: string }>;
  partial: string[];
  /** Set when a formula can't be worked out. */
  error: 'formula' | null;
  bands?: CashFlowBand[];
};

const NONE = 'none';
const CASH_TYPES = new Set(['bank', 'savings', 'cash', 'wallet', 'card']);

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthsBetween(from: string, to: string): string[] {
  return bucketsBetween(from, to, 'month');
}

const minDate = (a: string, b: string) => (a < b ? a : b);

/** A card's dates from its range preset (DESIGN.md page 19), ending today or at the month's end. */
export function rangeFor(preset: RangePreset, today: string, first: string | null): { from: string; to: string } {
  const month = today.slice(0, 7);
  switch (preset) {
    case 'this_month':
      return monthBounds(month);
    case 'last_month':
      return monthBounds(shiftMonth(month, -1));
    case 'last_3_months':
      return { from: monthBounds(shiftMonth(month, -2)).from, to: monthBounds(month).to };
    case 'this_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'last_12_months':
      return { from: monthBounds(shiftMonth(month, -11)).from, to: monthBounds(month).to };
    case 'all':
      return { from: first ? monthBounds(first.slice(0, 7)).from : monthBounds(month).from, to: monthBounds(month).to };
  }
}

/** Names, kinds and groups for the engine, from the device's copy. */
export function lookupOf(snapshot: Snapshot): Lookup {
  const categories = new Map(snapshot.categories.map((c) => [c.id, c]));
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a]));
  const payees = new Map(snapshot.payees.map((p) => [p.id, p.name]));
  return {
    kindOf: (id) => snapshot.chart.get(id)?.kind ?? null,
    categoryOf: (id) => snapshot.chart.get(id)?.categoryId ?? null,
    // Groups are named on the device; the name is the key.
    groupOf: (c) => categories.get(c)?.group ?? null,
    isCash: (id) => {
      const a = accounts.get(id);
      return !!a && CASH_TYPES.has(a.type);
    },
    label: (dim: Dimension, key: string) => {
      if (key === NONE) return '';
      switch (dim) {
        case 'category':
          return categories.get(key)?.name ?? snapshot.chart.get(key)?.name ?? '';
        case 'group':
          return key in catalogue ? t(key as TextKey) : key;
        case 'payee':
          return payees.get(key) ?? '';
        case 'account':
          return accounts.get(key)?.name ?? snapshot.chart.get(key)?.name ?? '';
        case 'tag':
          return key;
        case 'month':
          return key;
      }
    },
  };
}

/** Every line of every event, with what the dimensions need. Reversals and what they undo both count. */
export function factsOf(snapshot: Snapshot): Fact[] {
  const typeOf = new Map(snapshot.events.map((e) => [e.id, e.type]));
  return snapshot.events.flatMap((e) => {
    const accountIds = e.lines
      .map((l) => l.ledgerAccountId)
      .filter((id) => {
        const a = snapshot.chart.get(id);
        // Holding ledger accounts are linked via snapshot.holdings; exclude them from cash accountIds.
        const isHolding = !!a && snapshot.holdings.some((h) => h.ledgerAccountId === id);
        return !!a && (a.kind === 'asset' || a.kind === 'liability') && !a.system && !isHolding;
      });
    return e.lines.map((l) => ({
      eventId: e.id,
      date: e.date,
      type: e.type,
      ledgerAccountId: l.ledgerAccountId,
      amount: l.amountMinor,
      payeeId: e.payeeId ?? null,
      tagIds: [],
      accountIds,
      reversed: e.status === 'reversed',
      reversedType: e.reversalOf ? (typeOf.get(e.reversalOf) ?? null) : null,
    }));
  });
}

const filtersOf = (f: ReportFiltersModel | undefined): Filters => ({ ...f });

function drillFor(spec: Spec, t: Table): ReportResult['drill'] {
  const out: ReportResult['drill'] = {};
  for (const r of t.rows) {
    const base = { from: spec.from, to: spec.to };
    if (r.key === NONE) {
      out[r.key] = base;
      continue;
    }
    switch (spec.groupBy) {
      case 'category':
        out[r.key] = { ...base, categoryId: r.key };
        break;
      case 'payee':
        out[r.key] = { ...base, payeeId: r.key };
        break;
      case 'account':
        out[r.key] = { ...base, accountId: r.key };
        break;
      case 'month': {
        const b = bucketBounds(r.key, spec.interval);
        out[r.key] = { from: b.from < spec.from ? spec.from : b.from, to: minDate(b.to, spec.to) };
        break;
      }
      default:
        out[r.key] = base;
    }
  }
  return out;
}

function bucketBounds(key: string, interval: ReportInterval): { from: string; to: string } {
  switch (interval) {
    case 'day':
      return { from: key, to: key };
    case 'week': {
      const d = new Date(`${key}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 6);
      return { from: key, to: d.toISOString().slice(0, 10) };
    }
    case 'month':
      return monthBounds(key);
    case 'year':
      return { from: `${key}-01-01`, to: `${key}-12-31` };
  }
}

/** A table made by hand; `total` is each row's headline. With `closing`, totals are the last row's (balances). */
export function table(
  columns: { key: string; label: string }[],
  rows: { key: string; label: string; values: bigint[]; total?: bigint }[],
  closing = false,
): Table {
  const out = rows.map((r) => ({ ...r, total: r.total ?? r.values.reduce((s, v) => s + v, 0n) }));
  const columnTotals = closing
    ? (out.at(-1)?.values ?? columns.map(() => 0n))
    : columns.map((_, i) => out.reduce((s, r) => s + r.values[i]!, 0n));
  const total = closing ? (out.at(-1)?.total ?? 0n) : out.reduce((s, r) => s + r.total, 0n);
  return { columns, rows: out, columnTotals, total };
}

function finding(now: bigint, before: bigint, measure: string, previousFrom: string): Finding {
  const change = changeBasisPoints(now, before);
  const direction = change === null ? 'new' : change > 0n ? 'rose' : change < 0n ? 'fell' : 'same';
  return { key: `${measure}_${direction}`, amount: now, changeBasisPoints: change, previousFrom };
}

/** Assets, debts and unrealised gains on a date, and the month's adjustments and write-offs. */
function worthOn(snapshot: Snapshot, facts: Fact[], date: string) {
  const convert = converterFor(snapshot);
  const partial = new Set<string>();
  const balances = new Map<string, bigint>();
  let adjustments = 0n;
  let writtenOff = 0n;
  for (const f of facts) {
    if (f.date > date) continue;
    const a = snapshot.chart.get(f.ledgerAccountId);
    if (!a) continue;
    if ((a.kind === 'asset' || a.kind === 'liability') && !a.system) balances.set(a.id, (balances.get(a.id) ?? 0n) + f.amount);
    if (f.date.startsWith(date.slice(0, 7))) {
      if (a.system === 'adjustments' || a.system === 'revaluation') adjustments -= f.amount;
      if (a.system === 'written_off') writtenOff += f.amount;
    }
  }
  let assets = 0n;
  let debts = 0n;
  for (const [id, raw] of balances) {
    const a = snapshot.chart.get(id)!;
    const v = convert(raw, a.currency, date);
    if (v === null) {
      if (raw !== 0n) partial.add(a.currency);
      continue;
    }
    if (v >= 0n) assets += v;
    else debts -= v;
  }
  const unrealised = wealthAt(snapshot, date).unrealised;
  return { assets, debts, unrealised, adjustments, writtenOff, partial: [...partial] };
}

/** Runs one report on the device's data. */
export function runReport(snapshot: Snapshot, input: ReportInput, today: string): ReportResult {
  const look = lookupOf(snapshot);
  const facts = factsOf(snapshot);
  const { from, to, interval } = input;
  const prev = previousRange(from, to);
  const filters = filtersOf(input.filters);
  const spec = (s: Partial<Spec>): Spec => ({ show: 'spending', groupBy: 'category', splitBy: null, interval, from, to, filters, ...s });
  const base: Omit<ReportResult, 'chart' | 'unit' | 'table'> = {
    kind: input.kind,
    range: { from, to },
    previous: null,
    finding: null,
    drill: {},
    partial: [],
    error: null,
  };
  const empty = table([], []);

  switch (input.kind) {
    case 'spending_by_category': {
      const s = spec({});
      const t = run(s, facts, look);
      const p = run({ ...s, ...prev }, facts, look);
      return { ...base, chart: 'donut', unit: 'money', table: t, previous: input.compare ? p : null, finding: finding(t.total, p.total, 'spending', prev.from), drill: drillFor(s, t) };
    }
    case 'income_vs_expenses': {
      const s = spec({ show: 'income', groupBy: 'month' });
      const income = run(s, facts, look);
      const spent = run({ ...s, show: 'spending' }, facts, look);
      const t = table(
        [
          { key: 'income', label: 'income' },
          { key: 'spending', label: 'spending' },
        ],
        income.rows.map((r, i) => {
          const sp = spent.rows[i]?.total ?? 0n;
          return { key: r.key, label: r.label, values: [r.total, sp], total: r.total - sp };
        }),
      );
      return { ...base, chart: 'bar', unit: 'money', table: t, finding: finding(t.total, 0n, 'net', prev.from), drill: drillFor(s, t) };
    }
    case 'spending_trends': {
      const days = bucketsBetween(from, to, 'day');
      const cumulative = (start: string) => {
        const end = new Date(`${start}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + days.length - 1);
        const t = run(spec({ groupBy: 'month', interval: 'day', from: start, to: end.toISOString().slice(0, 10) }), facts, look);
        let sum = 0n;
        return t.rows.map((r) => (sum += r.total));
      };
      const a = cumulative(from);
      const p = cumulative(prev.from);
      const t = table(
        [
          { key: 'this', label: 'this' },
          { key: 'previous', label: 'previous' },
        ],
        days.map((d, i) => ({ key: d, label: d, values: [a[i] ?? 0n, p[i] ?? 0n], total: a[i] ?? 0n })),
        true,
      );
      return { ...base, chart: 'line', unit: 'money', table: t, finding: finding(a.at(-1) ?? 0n, p.at(-1) ?? 0n, 'spending', prev.from) };
    }
    case 'transaction_calendar': {
      const s = spec({ groupBy: 'month', interval: 'day' });
      const income = run({ ...s, show: 'income' }, facts, look);
      const spent = run(s, facts, look);
      const t = table(
        [
          { key: 'in', label: 'in' },
          { key: 'out', label: 'out' },
        ],
        income.rows.map((r, i) => ({ key: r.key, label: r.key, values: [r.total, spent.rows[i]?.total ?? 0n], total: r.total - (spent.rows[i]?.total ?? 0n) })),
      );
      return { ...base, chart: 'calendar', unit: 'money', table: t, drill: drillFor(s, t) };
    }
    case 'summary_number': {
      const show = input.spec?.show ?? 'spending';
      const s = spec({ show, groupBy: 'month', interval: 'year', filters: { ...filters, ...filtersOf(input.spec?.filters) } });
      const now = run(s, facts, look).total;
      const before = run({ ...s, ...prev }, facts, look).total;
      return {
        ...base,
        chart: 'number',
        unit: show === 'count' ? 'count' : 'money',
        table: table([{ key: 'total', label: 'total' }], [{ key: 'total', label: 'total', values: [now] }]),
        finding: show === 'balance' ? null : finding(now, before, show, prev.from),
        drill: { total: { from, to } },
      };
    }
    case 'custom': {
      const saved = input.spec ?? null;
      if (!saved) return { ...base, chart: 'table', unit: 'money', table: empty };
      const s = spec({ show: saved.show, groupBy: saved.groupBy, splitBy: saved.splitBy, filters: { ...filters, ...filtersOf(saved.filters) } });
      const t = run(s, facts, look);
      const p = input.compare ? run({ ...s, ...prev }, facts, look) : null;
      return {
        ...base,
        chart: saved.chart,
        unit: saved.show === 'count' ? 'count' : 'money',
        table: t,
        previous: p,
        finding: saved.show === 'balance' ? null : finding(t.total, p?.total ?? run({ ...s, ...prev }, facts, look).total, saved.show, prev.from),
        drill: drillFor(s, t),
      };
    }
    case 'net_worth': {
      const months = monthsBetween(from, to);
      const points = months.map((m) => worthOn(snapshot, facts, minDate(monthBounds(m).to, minDate(to, today))));
      const t = table(
        ['assets', 'debts', 'unrealised', 'adjustments', 'written_off'].map((k) => ({ key: k, label: k })),
        months.map((m, i) => {
          const p = points[i]!;
          return { key: m, label: m, values: [p.assets, p.debts, p.unrealised, p.adjustments, p.writtenOff], total: p.assets - p.debts + p.unrealised };
        }),
        true,
      );
      return {
        ...base,
        chart: 'line',
        unit: 'money',
        table: t,
        finding: finding(t.total, t.rows[0]?.total ?? 0n, 'net_worth', from),
        partial: [...new Set(points.flatMap((p) => p.partial))].sort(),
      };
    }
    case 'cash_flow': {
      const bands = cashFlowFor(snapshot, { from, to, accountIds: input.filters?.accountIds, includeTransfers: false });
      const t = table(
        [{ key: 'amount', label: 'amount' }],
        bands.map((b) => ({ key: b.key, label: bandLabel(snapshot, b), values: [b.amount] })),
      );
      return { ...base, chart: 'sankey', unit: 'money', table: t, bands };
    }
    case 'budget_analysis': {
      const rows = monthsBetween(from, to).map((m) => {
        const b = budgetForMonth(snapshot, m);
        let planned = 0n;
        let spent = 0n;
        for (const r of b.rows.values()) {
          planned += r.assigned;
          spent += r.activity;
        }
        return { key: m, label: m, values: [planned, spent], total: planned - spent };
      });
      return {
        ...base,
        chart: 'bar',
        unit: 'money',
        table: table(
          [
            { key: 'planned', label: 'planned' },
            { key: 'spent', label: 'spent' },
          ],
          rows,
        ),
      };
    }
    case 'age_of_money': {
      const ages = ageOfMoney(
        facts.filter((f) => f.date <= to),
        look,
      );
      return {
        ...base,
        chart: 'line',
        unit: 'days',
        table: table(
          [{ key: 'days', label: 'days' }],
          monthsBetween(from, to).map((m) => ({ key: m, label: m, values: [ages.get(m) ?? 0n] })),
          true,
        ),
      };
    }
    case 'balance_forecast':
      return { ...base, chart: 'area', unit: 'money', table: forecast(snapshot, facts, look, input.monthsAhead ?? 6, today) };
    case 'crossover': {
      const s = spec({ groupBy: 'month' });
      const investIncome = run(
        { ...s, show: 'income' },
        facts.filter((f) => {
          const key = snapshot.chart.get(f.ledgerAccountId)?.system;
          return key === 'investment_income' || key === 'investment_gain' || key === 'interest_earned';
        }),
        look,
      );
      const spent = run(s, facts, look);
      const t = table(
        [
          { key: 'investment_income', label: 'investment_income' },
          { key: 'spending', label: 'spending' },
        ],
        investIncome.rows.map((r, i) => ({ key: r.key, label: r.key, values: [r.total, spent.rows[i]?.total ?? 0n], total: r.total - (spent.rows[i]?.total ?? 0n) })),
      );
      const last = t.rows.at(-1);
      return {
        ...base,
        chart: 'line',
        unit: 'money',
        table: t,
        finding: last
          ? { key: last.total >= 0n ? 'crossover_reached' : 'crossover_gap', amount: last.total < 0n ? -last.total : last.total, changeBasisPoints: null, previousFrom: null }
          : null,
      };
    }
    case 'investment_performance': {
      const rows = holdingRows(snapshot, minDate(to, today))
        .map((r) => ({
          key: r.holding.id,
          label: r.holding.name,
          values: [r.position.cost, r.position.value, r.position.unrealised, r.position.realised],
          total: r.position.value,
        }));
      return { ...base, chart: 'bar', unit: 'money', table: table(['cost', 'value', 'unrealised', 'realised'].map((k) => ({ key: k, label: k })), rows) };
    }
    case 'debt_payoff':
      return { ...base, ...debtPayoff(snapshot, facts, from, minDate(to, today)) };
    case 'income_steadiness': {
      const streams = new Map<string, { label: string; expected: bigint; received: bigint }>();
      for (const m of monthsBetween(from, to)) {
        for (const r of incomeForMonth(snapshot, m).rows) {
          const row = streams.get(r.stream.id) ?? { label: r.stream.name, expected: 0n, received: 0n };
          row.expected += r.expected;
          row.received += r.received;
          streams.set(r.stream.id, row);
        }
      }
      return {
        ...base,
        chart: 'bar',
        unit: 'money',
        table: table(
          [
            { key: 'expected', label: 'expected' },
            { key: 'received', label: 'received' },
          ],
          [...streams].map(([id, s]) => ({ key: id, label: s.label, values: [s.expected, s.received], total: s.received })),
        ),
      };
    }
    case 'formula': {
      const income = run(spec({ show: 'income', groupBy: 'month', interval: 'year' }), facts, look).total;
      const spent = run(spec({ groupBy: 'month', interval: 'year' }), facts, look).total;
      const w = worthOn(snapshot, facts, minDate(to, today));
      try {
        const r = evaluate(input.formula ?? '', {
          income,
          spending: spent,
          net: income - spent,
          assets: w.assets + w.unrealised,
          debts: w.debts,
          net_worth: w.assets - w.debts + w.unrealised,
        });
        return {
          ...base,
          chart: 'number',
          unit: r.unit,
          table: table([{ key: 'value', label: 'value' }], [{ key: 'value', label: 'value', values: [r.value] }]),
          partial: w.partial,
        };
      } catch (e) {
        if (e instanceof FormulaError) return { ...base, chart: 'number', unit: 'money', table: empty, error: 'formula' };
        throw e;
      }
    }
    case 'note':
      return { ...base, chart: 'note', unit: 'money', table: empty };
  }
}

/** The next months from bills and income streams, with a likely range (DESIGN.md page 19). */
function forecast(snapshot: Snapshot, facts: Fact[], look: Lookup, monthsAhead: number, today: string): Table {
  const month = today.slice(0, 7);
  const history = [1, 2, 3].map((i) => shiftMonth(month, -i));
  const spentBy = history.map((m) => {
    const b = monthBounds(m);
    return run({ show: 'spending', groupBy: 'month', splitBy: null, interval: 'month', from: b.from, to: b.to, filters: {} }, facts, look).total;
  });
  const avg = roundHalfAwayFromZero(spentBy.reduce((s, v) => s + v, 0n), 3n);
  const hi = spentBy.reduce((a, v) => (v > a ? v : a), spentBy[0] ?? 0n);
  const lo = spentBy.reduce((a, v) => (v < a ? v : a), spentBy[0] ?? 0n);
  const spread = roundHalfAwayFromZero(hi - lo, 2n);
  let balance = 0n;
  for (const a of snapshot.accounts) {
    if (a.archived || !['bank', 'savings', 'cash', 'wallet'].includes(a.type)) continue;
    for (const f of facts) if (f.ledgerAccountId === a.id && f.date <= today) balance += converterFor(snapshot)(f.amount, a.currency, today) ?? 0n;
  }
  const rows = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const m = shiftMonth(month, i);
    let income = 0n;
    let bills = 0n;
    for (const r of snapshot.recurring) {
      if (r.cancelled) continue;
      const n = BigInt(dueDatesInMonth(r.rule, m, r.startDate, r.endDate).length);
      if (r.kind === 'income') income += BigInt(r.amountMinor) * n;
      else if (r.kind === 'bill' || r.kind === 'subscription') bills += BigInt(r.amountMinor) * n;
    }
    for (const s of snapshot.incomeStreams) {
      income += BigInt(s.expectedMinor) * BigInt(dueDatesInMonth(s.rule, m, `${month}-01`).length);
    }
    const other = avg > bills ? avg - bills : 0n;
    balance += income - bills - other;
    const band = spread * BigInt(i);
    rows.push({ key: m, label: m, values: [balance, balance - band, balance + band], total: balance });
  }
  return table(['expected', 'low', 'high'].map((k) => ({ key: k, label: k })), rows, true);
}

function debtPayoff(snapshot: Snapshot, facts: Fact[], from: string, to: string): Pick<ReportResult, 'chart' | 'unit' | 'table' | 'finding'> {
  const owedAt = (date: string) =>
    facts.reduce((s, f) => {
      const a = snapshot.chart.get(f.ledgerAccountId);
      return f.date <= date && a?.kind === 'liability' && !a.system ? s - f.amount : s;
    }, 0n);
  const months = monthsBetween(from, to);
  const rows = months.map((m) => {
    const owed = owedAt(minDate(monthBounds(m).to, to));
    return { key: m, label: m, values: [owed, 0n], total: owed };
  });
  const recent = rows.slice(-4).map((r) => r.total);
  const fall = recent.length > 1 ? roundHalfAwayFromZero(recent[0]! - recent.at(-1)!, BigInt(recent.length - 1)) : 0n;
  let owed = rows.at(-1)?.total ?? 0n;
  let month = months.at(-1) ?? from.slice(0, 7);
  let payoff: string | null = owed === 0n ? month : null;
  if (fall > 0n) {
    for (let i = 0; i < 60 && owed > 0n; i++) {
      month = shiftMonth(month, 1);
      owed = owed > fall ? owed - fall : 0n;
      rows.push({ key: month, label: month, values: [0n, owed], total: owed });
      if (owed === 0n) payoff = month;
    }
  }
  return {
    chart: 'area',
    unit: 'money',
    table: table(
      [
        { key: 'owed', label: 'owed' },
        { key: 'projected', label: 'projected' },
      ],
      rows,
      true,
    ),
    finding: { key: payoff ? 'debt_free_by' : 'debt_not_falling', amount: null, changeBasisPoints: null, previousFrom: payoff ? `${payoff}-01` : null },
  };
}

/** Cash flow bands for a range on the device (DESIGN.md page 22). */
export function cashFlowFor(
  snapshot: Snapshot,
  q: { from: string; to: string; accountIds?: string[]; includeTransfers: boolean },
): CashFlowBand[] {
  const facts = factsOf(snapshot).filter((f) => f.date >= q.from && f.date <= q.to);
  const goals = snapshot.allocations
    .filter((a) => a.kind !== 'spend' && a.date >= q.from && a.date <= q.to)
    .filter((a) => !q.accountIds?.length || q.accountIds.includes(a.fromAccountId))
    .reduce((s, a) => s + BigInt(a.amountMinor), 0n);
  return cashFlow(facts, lookupOf(snapshot), { goalAllocations: goals, includeTransfers: q.includeTransfers, accountIds: q.accountIds });
}

/** A band's name: its category, or what kind of money it is. */
export function bandLabel(snapshot: Snapshot, band: CashFlowBand): string {
  if (band.categoryId) return snapshot.categories.find((c) => c.id === band.categoryId)?.name ?? '';
  return band.kind;
}

/** Accounts that money is spent from, for filters. */
export function spendingAccounts(snapshot: Snapshot) {
  return snapshot.accounts.filter((a) => !a.archived && ACCOUNT_KIND_INFO[a.type].ledger === 'asset');
}

/** The first event's date, for "All". */
export function firstEventDate(snapshot: Snapshot): string | null {
  return snapshot.events.reduce<string | null>((a, e) => (a === null || e.date < a ? e.date : a), null);
}
