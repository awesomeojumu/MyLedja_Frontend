import type { HoldingLot, HoldingPrice } from '../../data/workspace/model';
import { formatUnits, parseUnits, roundUnitsCost } from '../../ledger/investments';

export type HoldingFigures = {
  /** Units still held, as a display number. */
  units: number;
  unitsMicro: bigint;
  /** Remaining cost of the open lots. */
  costMinor: bigint;
  /** Average cost per unit of what's still held. */
  avgCostMinor: bigint;
  /** Latest price entered, or the average cost when there's none (TECH-SPEC 6.8). */
  priceMinor: bigint;
  hasPrice: boolean;
};

const micro = (units: string | undefined) => {
  try {
    return parseUnits(units ?? '0');
  } catch {
    return 0n;
  }
};

/** What each holding is worth today, from its lots and the prices entered. */
export function holdingFigures(lots: HoldingLot[], prices: HoldingPrice[]): Map<string, HoldingFigures> {
  const out = new Map<string, HoldingFigures>();
  const byHolding = new Map<string, { units: bigint; cost: bigint }>();
  for (const lot of lots) {
    const bought = micro(lot.units);
    const left = bought - micro(lot.soldUnits);
    if (bought <= 0n || left <= 0n) continue;
    const cost = (BigInt(lot.costMinor || '0') * left) / bought;
    const acc = byHolding.get(lot.holdingId) ?? { units: 0n, cost: 0n };
    acc.units += left;
    acc.cost += cost;
    byHolding.set(lot.holdingId, acc);
  }
  const latest = new Map<string, HoldingPrice>();
  for (const p of prices) {
    const seen = latest.get(p.holdingId);
    if (!seen || p.date >= seen.date) latest.set(p.holdingId, p);
  }
  const ids = new Set([...byHolding.keys(), ...latest.keys()]);
  for (const id of ids) {
    const pos = byHolding.get(id) ?? { units: 0n, cost: 0n };
    const avg = pos.units > 0n ? roundUnitsCost(pos.cost, pos.units) : 0n;
    const price = latest.get(id);
    out.set(id, {
      units: Number(formatUnits(pos.units)),
      unitsMicro: pos.units,
      costMinor: pos.cost,
      avgCostMinor: avg,
      priceMinor: price ? BigInt(price.priceMinor) : avg,
      hasPrice: !!price,
    });
  }
  return out;
}
