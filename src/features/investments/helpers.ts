import type { Holding, HoldingLot, HoldingPrice, HoldingType } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { costOfPurchase, ledgerBalance } from '@/ledger';
import { formatNaira } from '@/money';

export const HOLDING_TYPES: HoldingType[] = [
  'stock',
  'fund',
  'pension',
  'crypto',
  'fixedDeposit',
  'land',
  'realEstate',
  'preciousMetals',
  'privateEquity',
  'other',
];

export type HoldingFigures = {
  holding: Holding;
  units: number;
  cost: bigint;
  price: bigint | null;
  priceDate: string | null;
  /** True when value fell back to cost because no price was entered (P17-06). */
  stalePrice: boolean;
  /** ISO day for "Price not updated since …" (last lot / last price / today). */
  staleSince: string | null;
  value: bigint;
  gain: bigint;
  gainPct: number | null;
  cagr: number | null;
  duration: string;
  breakEvenPct: number | null;
  isWrittenOff?: boolean;
};

export type PortfolioSummary = {
  figures: HoldingFigures[];
  yieldAssets: HoldingFigures[];
  growthAssets: HoldingFigures[];
  archivedAssets: HoldingFigures[];
  totalValue: bigint;
  totalCost: bigint;
  unrealised: bigint;
  realised: bigint;
  dividends: bigint;
  gainPct: number | null;
  writtenOffLossTotal: bigint;
  portfolioDrag: number;
  liquidity: {
    liquid: { value: bigint; pct: number };
    semiLiquid: { value: bigint; pct: number };
    illiquid: { value: bigint; pct: number };
  };
  series: { date: string; value: bigint }[];
  byType: { key: string; value: bigint }[];
  byAccount: { key: string; label: string; value: bigint }[];
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
  const bal = ledgerBalance(holding.ledgerAccountId, snapshot.events);
  if (bal > 0n) return bal;
  const lots = lotsFor(snapshot, holding.id);
  const fromLots = lots.reduce((s, l) => s + BigInt(l.costMinor), 0n);
  return fromLots > 0n ? fromLots : bal;
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
    const portion = lotUnits > 0 ? (lotCost * BigInt(Math.round(take * 1e8))) / BigInt(Math.round(lotUnits * 1e8)) : 0n;
    cost += portion || share;
    left -= take;
    if (left <= 1e-9) break;
  }
  return { cost, ok: left <= 1e-9 };
}

function staleSinceDate(snapshot: Snapshot, holdingId: string, priceDate: string | null, onDate?: string): string {
  if (priceDate) return priceDate;
  const lots = lotsFor(snapshot, holdingId);
  const lastLot = lots.length ? lots[lots.length - 1]!.date : null;
  if (lastLot) return lastLot;
  return onDate ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

/** Cash account for buy/sell/dividend: last used on this holding's trades, else last used cash, else first. */
export function defaultCashAccountId(snapshot: Snapshot, holdingId?: string): string {
  const cashIds = new Set(
    snapshot.accounts.filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type)).map((a) => a.id),
  );
  if (holdingId) {
    for (const e of snapshot.events) {
      if (e.status !== 'posted') continue;
      if (e.type !== 'investment_buy' && e.type !== 'investment_sell' && !(e.type === 'income' && e.holdingId === holdingId)) continue;
      if (e.holdingId && e.holdingId !== holdingId) continue;
      const cash = e.lines.find((l) => cashIds.has(l.ledgerAccountId));
      if (cash) return cash.ledgerAccountId;
    }
  }
  for (const e of snapshot.events) {
    if (e.type === 'opening_balance' || e.type === 'reversal' || e.status !== 'posted') continue;
    const cash = e.lines.find((l) => cashIds.has(l.ledgerAccountId));
    if (cash) return cash.ledgerAccountId;
  }
  return [...cashIds][0] ?? '';
}


export function isYieldAsset(type: HoldingType): boolean {
  return type === 'stock' || type === 'fund' || type === 'fixedDeposit' || type === 'pension';
}

export function isGrowthAsset(type: HoldingType): boolean {
  return !isYieldAsset(type);
}

export function calculateCAGR(
  currentValue: bigint,
  costBasis: bigint,
  firstDate: string | null,
  currentDate: string,
): number | null {
  if (!firstDate || costBasis <= 0n || currentValue <= 0n) return null;
  const d1 = new Date(firstDate).getTime();
  const d2 = new Date(currentDate).getTime();
  const days = (d2 - d1) / (1000 * 60 * 60 * 24);
  const years = days / 365.25;
  if (years < 0.25) return null; // Under 3 months
  const ratio = Number(currentValue) / Number(costBasis);
  const cagr = Math.pow(ratio, 1 / years) - 1;
  return Number.isFinite(cagr) ? Math.round(cagr * 1000) / 10 : null;
}

export function holdingDuration(firstDate: string | null, currentDate: string): string {
  if (!firstDate) return '';
  const d1 = new Date(firstDate).getTime();
  const d2 = new Date(currentDate).getTime();
  const days = Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
  if (days < 30) return `${days}d`;
  const totalMonths = Math.floor(days / 30.4375);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}

export function portfolioLiquidityTiers(
  snapshot: Snapshot,
  figures: HoldingFigures[],
): {
  liquid: { value: bigint; pct: number };
  semiLiquid: { value: bigint; pct: number };
  illiquid: { value: bigint; pct: number };
} {
  // Cash accounts are liquid
  let liquid = snapshot.accounts
    .filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type))
    .reduce((s, a) => s + ledgerBalance(a.id, snapshot.events), 0n);
  if (liquid < 0n) liquid = 0n;

  let semiLiquid = 0n;
  let illiquid = 0n;

  for (const f of figures) {
    if (f.holding.isWrittenOff) continue;
    const t = f.holding.type;
    if (t === 'stock' || t === 'fund' || t === 'crypto') {
      semiLiquid += f.value;
    } else {
      illiquid += f.value;
    }
  }

  const total = liquid + semiLiquid + illiquid;
  if (total === 0n) {
    return {
      liquid: { value: 0n, pct: 0 },
      semiLiquid: { value: 0n, pct: 0 },
      illiquid: { value: 0n, pct: 0 },
    };
  }
  const liquidPct = Math.round(Number((liquid * 10000n) / total) / 100);
  const semiLiquidPct = Math.round(Number((semiLiquid * 10000n) / total) / 100);
  const illiquidPct = 100 - liquidPct - semiLiquidPct;

  return {
    liquid: { value: liquid, pct: liquidPct },
    semiLiquid: { value: semiLiquid, pct: semiLiquidPct },
    illiquid: { value: illiquid, pct: illiquidPct },
  };
}

export function holdingFigures(snapshot: Snapshot, holding: Holding, onDate?: string): HoldingFigures {
  const units = holdingUnits(snapshot, holding.id);
  const cost = holdingCost(snapshot, holding);
  const px = latestPrice(snapshot, holding.id, onDate);
  const price = px ? BigInt(px.priceMinor) : null;
  const stalePrice = price === null;
  const priceDate = px?.date ?? null;
  const staleSince = stalePrice ? staleSinceDate(snapshot, holding.id, priceDate, onDate) : null;
  const firstDate = firstHoldingDate(snapshot, holding.id);
  const today = onDate ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

  if (holding.isWrittenOff) {
    const salvage = holding.writeOffSalvageMinor ? BigInt(holding.writeOffSalvageMinor) : 0n;
    const value = salvage;
    const gain = value - cost;
    const gainPct = cost === 0n ? null : Number((gain * 10000n) / cost) / 100;
    return {
      holding,
      units,
      cost,
      price: null,
      priceDate: holding.writeOffDate ?? priceDate,
      stalePrice: false,
      staleSince: null,
      value,
      gain,
      gainPct,
      cagr: null,
      duration: holdingDuration(firstDate, holding.writeOffDate ?? today),
      breakEvenPct: -100,
      isWrittenOff: true,
    };
  }

  const value = price !== null ? costOfPurchase(String(units), price, 0n) : cost;
  const gain = value - cost;
  const gainPct = cost === 0n ? null : Number((gain * 10000n) / cost) / 100;
  const cagr = calculateCAGR(value, cost, firstDate, today);
  const duration = holdingDuration(firstDate, today);
  const breakEvenPct = gainPct;

  return {
    holding,
    units,
    cost,
    price,
    priceDate,
    stalePrice,
    staleSince,
    value,
    gain,
    gainPct,
    cagr,
    duration,
    breakEvenPct,
    isWrittenOff: false,
  };
}

export function portfolioFigures(snapshot: Snapshot, accountId?: string): HoldingFigures[] {
  return snapshot.holdings
    .filter((h) => !accountId || h.accountId === accountId)
    .map((h) => holdingFigures(snapshot, h))
    .sort((a, b) => (a.value === b.value ? a.holding.name.localeCompare(b.holding.name) : a.value > b.value ? -1 : 1));
}

export function rangeStart(range: Range, today: string): string | null {
  if (range === 'All') return null;
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (range === '1M') dt.setUTCMonth(dt.getUTCMonth() - 1);
  if (range === '3M') dt.setUTCMonth(dt.getUTCMonth() - 3);
  if (range === '6M') dt.setUTCMonth(dt.getUTCMonth() - 6);
  if (range === '1Y') dt.setUTCFullYear(dt.getUTCFullYear() - 1);
  return dt.toISOString().slice(0, 10);
}

export type Range = '1M' | '3M' | '6M' | '1Y' | 'All';
export const RANGES: Range[] = ['1M', '3M', '6M', '1Y', 'All'];

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
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Value-line dates (mirrors BE investments.service seriesDates). */
export function seriesDates(range: Range, today: string, first: string | null): string[] {
  const start = rangeStart(range, today) ?? (first && first < today ? first : today);
  const out: string[] = [];
  if (range === '1M' || range === '3M' || range === '6M') {
    for (let d = today; d >= start; d = addDays(d, -7)) out.unshift(d);
    return out.length ? out : [today];
  }
  let month = today.slice(0, 7);
  out.unshift(today);
  for (let i = 0; i < 120; i++) {
    month = addMonths(month, -1);
    const end = monthEnd(month);
    if (end < start.slice(0, 7) + '-01') break;
    out.unshift(end);
  }
  return out;
}

function realisedInRange(snapshot: Snapshot, start: string | null): bigint {
  let total = 0n;
  for (const e of snapshot.events) {
    if (e.type !== 'investment_sell' || e.status !== 'posted') continue;
    if (start && e.date < start) continue;
    for (const l of e.lines) {
      if (l.ledgerAccountId.endsWith(':investment_gain') || l.ledgerAccountId.endsWith(':investment_loss')) {
        total += -l.amountMinor;
      }
    }
  }
  return total;
}

function dividendsInRange(snapshot: Snapshot, start: string | null): bigint {
  let total = 0n;
  for (const e of snapshot.events) {
    if (e.type !== 'income' || e.status !== 'posted' || !e.holdingId) continue;
    if (start && e.date < start) continue;
    for (const l of e.lines) {
      if (l.ledgerAccountId.endsWith(':investment_income')) total += -l.amountMinor;
    }
  }
  return total;
}

/** Portfolio card + charts for Page 17 (DESIGN / TB08-1). */
export function portfolioSummary(snapshot: Snapshot, range: Range, today: string): PortfolioSummary {
  const allFigures = portfolioFigures(snapshot);
  const activeFigures = allFigures.filter((f) => !f.holding.archived && !f.holding.isWrittenOff);
  const archivedAssets = allFigures.filter((f) => f.holding.archived || f.holding.isWrittenOff);

  const yieldAssets = activeFigures.filter((f) => isYieldAsset(f.holding.type));
  const growthAssets = activeFigures.filter((f) => isGrowthAsset(f.holding.type));

  const start = rangeStart(range, today);
  const totalValue = activeFigures.reduce((s, f) => s + f.value, 0n);
  const totalCost = activeFigures.reduce((s, f) => s + f.cost, 0n);
  const unrealised = totalValue - totalCost;
  const realised = realisedInRange(snapshot, start);
  const dividends = dividendsInRange(snapshot, start);
  const gainPct = totalCost === 0n ? null : Number((unrealised * 10000n) / totalCost) / 100;

  let writtenOffLossTotal = 0n;
  for (const a of archivedAssets) {
    if (a.holding.isWrittenOff) {
      writtenOffLossTotal += a.cost - a.value;
    }
  }
  const peakCapital = totalCost + writtenOffLossTotal;
  const portfolioDrag = peakCapital > 0n ? Math.round(Number((writtenOffLossTotal * 10000n) / peakCapital) / 100) : 0;

  const liquidity = portfolioLiquidityTiers(snapshot, activeFigures);

  const firstTrade =
    snapshot.events
      .filter((e) => (e.type === 'investment_buy' || e.type === 'investment_sell') && e.status === 'posted')
      .map((e) => e.date)
      .sort()[0] ?? null;
  const dates = seriesDates(range, today, firstTrade);
  const series = dates.map((date) => ({
    date,
    value: snapshot.holdings
      .filter((h) => !h.archived && !h.isWrittenOff)
      .reduce((s, h) => s + holdingFigures(snapshot, h, date).value, 0n),
  }));

  const byTypeMap = new Map<string, bigint>();
  const byAccountMap = new Map<string, bigint>();
  for (const f of activeFigures) {
    byTypeMap.set(f.holding.type, (byTypeMap.get(f.holding.type) ?? 0n) + f.value);
    byAccountMap.set(f.holding.accountId, (byAccountMap.get(f.holding.accountId) ?? 0n) + f.value);
  }
  const byType = [...byTypeMap.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => (a.value === b.value ? a.key.localeCompare(b.key) : a.value > b.value ? -1 : 1));
  const byAccount = [...byAccountMap.entries()]
    .map(([key, value]) => ({
      key,
      label: snapshot.accounts.find((a) => a.id === key)?.name ?? key,
      value,
    }))
    .sort((a, b) => (a.value === b.value ? a.label.localeCompare(b.label) : a.value > b.value ? -1 : 1));

  return {
    figures: activeFigures,
    yieldAssets,
    growthAssets,
    archivedAssets,
    totalValue,
    totalCost,
    unrealised,
    realised,
    dividends,
    gainPct,
    writtenOffLossTotal,
    portfolioDrag,
    liquidity,
    series,
    byType,
    byAccount,
  };
}

/** Format a signed gain with +/− (DESIGN D7). */
export function formatGain(amount: bigint, pct: number | null): string {
  const sign = amount > 0n ? '+' : amount < 0n ? '−' : '';
  const abs = amount < 0n ? -amount : amount;
  const body = `${sign}${formatNaira(abs)}`;
  return pct === null ? body : `${body} (${sign}${Math.abs(pct).toFixed(1)}%)`;
}

export function isDown(gainPct: number | null): boolean {
  return gainPct !== null && gainPct < -10;
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
