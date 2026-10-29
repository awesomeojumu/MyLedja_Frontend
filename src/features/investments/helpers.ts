import type { Holding, HoldingLot, HoldingPrice, HoldingType } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { costOfPurchase, ledgerBalance } from '@/ledger';

export const HOLDING_TYPES: HoldingType[] = ['stock', 'fund', 'pension', 'crypto', 'fixedDeposit', 'other'];

export type HoldingFigures = {
  holding: Holding;
  units: number;
  cost: bigint;
  price: bigint | null;
  priceDate: string | null;
  value: bigint;
  gain: bigint;
  gainPct: number | null;
};

export function lotsFor(snapshot: Snapshot, holdingId: string): HoldingLot[] {
  return snapshot.lots
    .filter((l) => l.holdingId === holdingId)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
}

export function pricesFor(snapshot: Snapshot, holdingId: string): HoldingPrice[] {
  return snapshot.prices
    .filter((p) => p.holdingId === holdingId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function latestPrice(snapshot: Snapshot, holdingId: string, onOrBefore?: string): HoldingPrice | null {
  const rows = pricesFor(snapshot, holdingId).filter((p) => !onOrBefore || p.date <= onOrBefore);
  return rows[0] ?? null;
}

export function openUnits(lot: HoldingLot): number {
  return Number(lot.units) - Number(lot.soldUnits || '0');
}

export function holdingUnits(snapshot: Snapshot, holdingId: string): number {
  return lotsFor(snapshot, holdingId).reduce((s, l) => s + openUnits(l), 0);
}

export function holdingCost(snapshot: Snapshot, holding: Holding): bigint {
  return ledgerBalance(holding.ledgerAccountId, snapshot.events);
}

/** FIFO cost for selling `units` (TECH-SPEC 6.8). */
export function fifoCost(snapshot: Snapshot, holdingId: string, units: number): { cost: bigint; ok: boolean } {
  if (units <= 0) return { cost: 0n, ok: false };
  let left = units;
  let cost = 0n;
  for (const lot of lotsFor(snapshot, holdingId)) {
    const open = openUnits(lot);
    if (open <= 0) continue;
    const take = Math.min(open, left);
    const lotCost = BigInt(lot.costMinor);
    const lotUnits = Number(lot.units);
    const share = costOfPurchase(String(take), lotUnits > 0 ? lotCost / BigInt(Math.round(lotUnits)) : 0n, 0n);
    // Prefer proportional cost: take/lotUnits * lotCost
    const portion = lotUnits > 0 ? (lotCost * BigInt(Math.round(take * 1e8))) / BigInt(Math.round(lotUnits * 1e8)) : 0n;
    cost += portion || share;
    left -= take;
    if (left <= 1e-9) break;
  }
  return { cost, ok: left <= 1e-9 };
}

export function holdingFigures(snapshot: Snapshot, holding: Holding, onDate?: string): HoldingFigures {
  const units = holdingUnits(snapshot, holding.id);
  const cost = holdingCost(snapshot, holding);
  const px = latestPrice(snapshot, holding.id, onDate);
  const price = px ? BigInt(px.priceMinor) : null;
  const value = price !== null ? costOfPurchase(String(units), price, 0n) : cost;
  const gain = value - cost;
  const gainPct = cost === 0n ? null : Number((gain * 10000n) / cost) / 100;
  return { holding, units, cost, price, priceDate: px?.date ?? null, value, gain, gainPct };
}

export function portfolioFigures(snapshot: Snapshot, accountId?: string): HoldingFigures[] {
  return snapshot.holdings
    .filter((h) => !accountId || h.accountId === accountId)
    .map((h) => holdingFigures(snapshot, h))
    .sort((a, b) => (a.value === b.value ? a.holding.name.localeCompare(b.holding.name) : a.value > b.value ? -1 : 1));
}

export function rangeStart(range: '1M' | '3M' | '1Y' | 'All', today: string): string | null {
  if (range === 'All') return null;
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (range === '1M') dt.setUTCMonth(dt.getUTCMonth() - 1);
  if (range === '3M') dt.setUTCMonth(dt.getUTCMonth() - 3);
  if (range === '1Y') dt.setUTCFullYear(dt.getUTCFullYear() - 1);
  return dt.toISOString().slice(0, 10);
}

export type Range = '1M' | '3M' | '1Y' | 'All';
export const RANGES: Range[] = ['1M', '3M', '1Y', 'All'];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sample dates for a holding performance series (value vs cost). */
export function seriesDates(range: Range, today: string, first: string | null): string[] {
  const start = rangeStart(range, today) ?? (first && first < today ? first : today);
  const out: string[] = [];
  if (range === '1M' || range === '3M') {
    for (let d = today; d >= start; d = addDays(d, -7)) out.unshift(d);
    return out.length ? out : [today];
  }
  let cursor = today;
  out.unshift(today);
  for (let i = 0; i < 24; i++) {
    cursor = addDays(cursor, -30);
    if (cursor < start) break;
    out.unshift(cursor);
  }
  return out;
}

/** First buy/reinvest date for "All". */
export function firstHoldingDate(snapshot: Snapshot, holdingId: string): string | null {
  const lots = lotsFor(snapshot, holdingId);
  return lots[0]?.date ?? null;
}

/** Remaining cost of open units in a lot. */
export function lotOpenCost(lot: HoldingLot): bigint {
  const open = openUnits(lot);
  const bought = Number(lot.units);
  if (bought <= 0 || open <= 0) return 0n;
  return (BigInt(lot.costMinor) * BigInt(Math.round(open * 1e6))) / BigInt(Math.round(bought * 1e6));
}

/** Performance series for one holding: market value and remaining cost on each sample date. */
export function holdingSeries(
  snapshot: Snapshot,
  holding: Holding,
  range: Range,
  today: string,
): { date: string; value: bigint; cost: bigint }[] {
  const first = firstHoldingDate(snapshot, holding.id);
  return seriesDates(range, today, first).map((date) => {
    const figs = holdingFigures(snapshot, holding, date);
    // Cost uses ledger balance which is "as of now"; approximate open cost from lots dated ≤ date.
    const cost = lotsFor(snapshot, holding.id)
      .filter((l) => l.date <= date)
      .reduce((s, l) => s + lotOpenCost(l), 0n);
    return { date, value: figs.value, cost: cost > 0n ? cost : figs.cost };
  });
}
