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
