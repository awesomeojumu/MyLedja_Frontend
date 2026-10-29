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


/** FX converter from workspace rates (TECH-SPEC 6.5). */
export type Converter = (amount: bigint, from: string, date: string) => bigint | null;

export function converterFor(snapshot: Pick<Snapshot, 'settings'>): Converter {
  const home = snapshot.settings.currency ?? 'NGN';
  const rates = [...(snapshot.settings.exchangeRates ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (amount, from, date) => {
    if (from === home) return amount;
    const rate = rates.find((r) => r.currency === from && r.date <= date);
    if (!rate) return null;
    const n = Number(rate.rate);
    if (!Number.isFinite(n) || n <= 0) return null;
    return BigInt(Math.round(Number(amount) * n));
  };
}

export type HoldingRow = {
  holding: Holding;
  position: { cost: bigint; value: bigint; unrealised: bigint; realised: bigint; units: number };
  currency: string;
};

/** Holding rows for reports on a date. */
export function holdingRows(snapshot: Pick<Snapshot, 'holdings' | 'lots' | 'prices' | 'events'>, date: string): HoldingRow[] {
  return snapshot.holdings.map((holding) => {
      const fig = holdingFigures(snapshot as Snapshot, holding, date);
      return {
        holding,
        currency: holding.currency,
        position: { cost: fig.cost, value: fig.value, unrealised: fig.gain, realised: 0n, units: fig.units },
      };
    });
}

export type Wealth = { total: bigint; partial: string[]; unrealised: bigint };

/** Net worth on a date for reports (assets − debts + unrealised). */
export function wealthAt(snapshot: Snapshot, date: string): Wealth {
  const convert = converterFor(snapshot);
  let total = 0n;
  const partial = new Set<string>();
  for (const a of snapshot.accounts.filter((x) => !x.archived)) {
    const bal = ledgerBalance(
      a.id,
      snapshot.events.filter((e) => e.date <= date),
    );
    const v = convert(bal, a.currency ?? snapshot.settings.currency, date);
    if (v === null) partial.add(a.currency ?? snapshot.settings.currency);
    else total += v;
  }
  let unrealised = 0n;
  for (const row of holdingRows(snapshot, date)) {
    const v = convert(row.position.unrealised, row.currency, date);
    if (v === null) partial.add(row.currency);
    else {
      unrealised += v;
      total += v;
    }
  }
  return { total, partial: [...partial].sort(), unrealised };
}
