import type { Holding } from '@/data/workspace/model';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import {
  converterOf,
  latestPrice,
  lotsFrom,
  netWorth,
  position,
  roundUnitsCost,
  type Converter,
  type Lot,
  type Position,
  type Price,
} from '@/ledger';

/** Prices as the ledger formulas want them. */
export function pricesOf(snapshot: Pick<Snapshot, 'prices'>): Price[] {
  return snapshot.prices.map((p) => ({ holdingId: p.holdingId, date: p.date, priceMinor: BigInt(p.priceMinor) }));
}

export function converterFor(snapshot: Pick<Snapshot, 'rates' | 'settings'>): Converter {
  return converterOf(snapshot.rates, snapshot.settings.currency);
}

const asInvestmentEvents = (events: readonly TxEvent[]) =>
  events.map((e) => ({ ...e, holdingId: e.holdingId ?? null, investment: e.investment ?? null }));

export type HoldingRow = { holding: Holding; lots: Lot[]; position: Position };

/** Every holding's lots and position on a date, from the events on this device (TECH-SPEC 6.8). */
export function holdingRows(snapshot: Pick<Snapshot, 'holdings' | 'events' | 'prices'>, date: string): HoldingRow[] {
  const lots = lotsFrom(asInvestmentEvents(snapshot.events.filter((e) => e.date <= date)));
  const prices = pricesOf(snapshot);
  return snapshot.holdings.map((holding) => {
    const held = lots.get(holding.id) ?? [];
    return { holding, lots: held, position: position(held, prices, holding.id, date) };
  });
}

export type Wealth = { total: bigint; partial: string[]; unrealised: bigint };

/**
 * Net worth on a date (TECH-SPEC 6.7): everything you have minus everything you owe, other currencies
 * converted at the latest rate on or before the date, and holdings at market value. A balance with no
 * rate is left out and its currency named in `partial`.
 */
export function wealthAt(snapshot: Snapshot, date: string): Wealth {
  const convert = converterFor(snapshot);
  const base = netWorth(snapshot.chart, snapshot.events, date, convert, snapshot.settings.currency);
  const partial = new Set(base.partial);
  let unrealised = 0n;
  for (const row of holdingRows(snapshot, date)) {
    const v = convert(row.position.unrealised, row.holding.currency, date);
    if (v === null) partial.add(row.holding.currency);
    else unrealised += v;
  }
  return { total: base.total + unrealised, partial: [...partial].sort(), unrealised };
}

/** Market value of the holdings in each investment account, in the account's currency. */
export function holdingsValueByAccount(snapshot: Snapshot, date: string): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const row of holdingRows(snapshot, date)) {
    out.set(row.holding.accountId, (out.get(row.holding.accountId) ?? 0n) + row.position.value);
  }
  return out;
}

/** The price a holding's value used, and whether it fell back to cost (P17-06). */
export function priceStatus(snapshot: Pick<Snapshot, 'prices'>, holdingId: string, date: string) {
  const p = latestPrice(pricesOf(snapshot), holdingId, date);
  return p ? { price: p.priceMinor, date: p.date } : null;
}

/** Cost per unit, for "Avg cost" (DESIGN.md page 17). */
export function averageCost(position: Position): bigint | null {
  return position.units > 0n ? roundUnitsCost(position.cost, position.units) : null;
}

/** A loss of more than 10% gets a ruby dot and the word "Down" (DESIGN.md page 17). */
export function isDown(position: Position): boolean {
  return position.cost > 0n && position.unrealised * 10n < -position.cost;
}

/** Gain as basis points of cost, or null with no cost. */
export function gainBasisPoints(gain: bigint, cost: bigint): bigint | null {
  if (cost <= 0n) return null;
  return (gain * 10_000n) / cost;
}

export const RANGES = ['1M', '3M', '1Y', 'All'] as const;
export type Range = (typeof RANGES)[number];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** The first day a range covers, ending today (the same as the server's). */
export function rangeStart(range: Range, today: string, first: string | null): string {
  switch (range) {
    case '1M':
      return addDays(today, -30);
    case '3M':
      return addDays(today, -91);
    case '1Y':
      return addDays(today, -365);
    case 'All':
      return first && first < today ? first : today;
  }
}

/** Points for a value line: weekly for 1M and 3M, month ends for longer ranges, always ending today. */
export function seriesDates(range: Range, today: string, first: string | null): string[] {
  const start = rangeStart(range, today, first);
  const out: string[] = [];
  if (range === '1M' || range === '3M') {
    for (let d = today; d >= start; d = addDays(d, -7)) out.unshift(d);
    return out;
  }
  let month = today.slice(0, 7);
  out.unshift(today);
  for (let i = 0; i < 120; i++) {
    month = addMonths(month, -1);
    const end = monthEnd(month);
    if (end < `${start.slice(0, 7)}-01`) break;
    out.unshift(end);
  }
  return out;
}

/** The date of the first investment event, for "All". */
export function firstInvestmentDate(snapshot: Pick<Snapshot, 'events'>, holdingId?: string): string | null {
  let first: string | null = null;
  for (const e of snapshot.events) {
    if (!e.investment || (holdingId && e.holdingId !== holdingId)) continue;
    if (first === null || e.date < first) first = e.date;
  }
  return first;
}

export type Portfolio = {
  value: bigint;
  cost: bigint;
  unrealised: bigint;
  realised: bigint;
  dividends: bigint;
  partial: string[];
  rows: HoldingRow[];
  byType: { type: Holding['type']; value: bigint }[];
  byAccount: { accountId: string; value: bigint }[];
  series: { date: string; value: bigint; cost: bigint }[];
};

/** Everything the Investments page shows (DESIGN.md page 17), in the home currency. */
export function portfolio(snapshot: Snapshot, range: Range, today: string): Portfolio {
  const convert = converterFor(snapshot);
  const partial = new Set<string>();
  const home = (v: bigint, from: string, date: string) => {
    const x = convert(v, from, date);
    if (x === null) partial.add(from);
    return x ?? 0n;
  };
  const rows = holdingRows(snapshot, today).filter((r) => !r.holding.archived);
  let value = 0n;
  let cost = 0n;
  const byType = new Map<Holding['type'], bigint>();
  const byAccount = new Map<string, bigint>();
  for (const r of rows) {
    const v = home(r.position.value, r.holding.currency, today);
    value += v;
    cost += home(r.position.cost, r.holding.currency, today);
    byType.set(r.holding.type, (byType.get(r.holding.type) ?? 0n) + v);
    byAccount.set(r.holding.accountId, (byAccount.get(r.holding.accountId) ?? 0n) + v);
  }
  const first = firstInvestmentDate(snapshot);
  const start = rangeStart(range, today, first);
  const currencyOf = new Map(snapshot.holdings.map((h) => [h.id, h.currency]));
  let realised = 0n;
  let dividends = 0n;
  for (const e of snapshot.events) {
    if (!e.investment || e.status !== 'posted' || e.date < start || e.date > today) continue;
    const from = currencyOf.get(e.holdingId ?? '') ?? snapshot.settings.currency;
    if (e.investment.kind === 'sell') {
      const proceeds = e.lines.find((l) => l.amountMinor > 0n && l.ledgerAccountId !== e.holdingId)?.amountMinor ?? 0n;
      const soldCost = e.investment.lots.reduce((s, l) => s + BigInt(l.cost), 0n);
      realised += home(proceeds - soldCost, from, e.date);
    } else if (e.investment.kind === 'dividend' || e.investment.kind === 'reinvest') {
      dividends += home(-(e.lines.find((l) => l.amountMinor < 0n)?.amountMinor ?? 0n), from, e.date);
    }
  }
  const series = seriesDates(range, today, first).map((date) => {
    let v = 0n;
    let c = 0n;
    for (const r of holdingRows(snapshot, date)) {
      if (r.holding.archived) continue;
      v += home(r.position.value, r.holding.currency, date);
      c += home(r.position.cost, r.holding.currency, date);
    }
    return { date, value: v, cost: c };
  });
  const desc = <K,>(m: Map<K, bigint>) => [...m].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
  return {
    value,
    cost,
    unrealised: value - cost,
    realised,
    dividends,
    partial: [...partial].sort(),
    rows,
    byType: desc(byType).map(([type, v]) => ({ type, value: v })),
    byAccount: desc(byAccount).map(([accountId, v]) => ({ accountId, value: v })),
    series,
  };
}

/** Units as typed: up to 6 decimal places, above zero. */
export const isUnits = (text: string) => /^(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(text.trim()) && /[1-9]/.test(text);
