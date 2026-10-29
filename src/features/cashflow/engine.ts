// Cash flow bands — kept the same as MyLedja_Backend reports/engine cashFlow (TECH-SPEC 6.12).
import type { LedgerKind } from '@/ledger/types';

export type Fact = {
  eventId: string;
  date: string;
  type: string;
  ledgerAccountId: string;
  amount: bigint;
  payeeId: string | null;
  tagIds: readonly string[];
  accountIds: readonly string[];
  reversedType?: string | null;
  reversed?: boolean;
};

export type Lookup = {
  kindOf(ledgerAccountId: string): LedgerKind | null;
  categoryOf(ledgerAccountId: string): string | null;
  groupOf(categoryId: string): string | null;
  isCash(ledgerAccountId: string): boolean;
};

export function previousRange(from: string, to: string): { from: string; to: string } {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  const pTo = new Date(a);
  pTo.setUTCDate(pTo.getUTCDate() - 1);
  const pFrom = new Date(pTo);
  pFrom.setUTCDate(pFrom.getUTCDate() - (days - 1));
  return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10) };
}

export function changeBasisPoints(now: bigint, before: bigint): bigint | null {
  if (before === 0n) return null;
  const diff = (now - before) * 10_000n;
  const q = diff / (before < 0n ? -before : before);
  return q;
}
export type CashFlowBand = {
  key: string;
  side: 'in' | 'out';
  /** income: a category earned; borrowed, collected, returns: money in that isn't income (grey on the left);
   * spending: a category spent; goals, debt_payments, lent, investments: money out that isn't spending;
   * left_over: what's left (gold); transfers: only when switched on. */
  kind:
    | 'income'
    | 'borrowed'
    | 'collected'
    | 'returns'
    | 'transfers'
    | 'spending'
    | 'goals'
    | 'debt_payments'
    | 'lent'
    | 'investments'
    | 'left_over'
    | 'shortfall';
  categoryId: string | null;
  groupId: string | null;
  amount: bigint;
};

/**
 * Cash flow bands (DESIGN.md 9.2's last column, page 22). Income bands add up to Income and spending bands
 * to Spent (B5.3's test). Facts must be the range's events; `goalAllocations` are E18 earmarks in the range.
 */
export function cashFlow(
  facts: readonly Fact[],
  look: Lookup,
  opts: { goalAllocations: bigint; includeTransfers: boolean; accountIds?: readonly string[] },
): CashFlowBand[] {
  const byCategory = new Map<string, { kind: 'income' | 'spending'; amount: bigint }>();
  const other = new Map<CashFlowBand['kind'], bigint>();
  const bump = (k: CashFlowBand['kind'], v: bigint) => other.set(k, (other.get(k) ?? 0n) + v);
  const events = new Map<string, Fact[]>();
  for (const f of facts) {
    if (opts.accountIds?.length && !f.accountIds.some((a) => opts.accountIds!.includes(a))) continue;
    const kind = look.kindOf(f.ledgerAccountId);
    if (kind === 'income' || kind === 'expense') {
      const cat = look.categoryOf(f.ledgerAccountId) ?? `ledger:${f.ledgerAccountId}`;
      const row = byCategory.get(cat) ?? { kind: kind === 'income' ? 'income' : 'spending', amount: 0n };
      row.amount += kind === 'income' ? -f.amount : f.amount;
      byCategory.set(cat, row);
    }
    const list = events.get(f.eventId) ?? [];
    list.push(f);
    events.set(f.eventId, list);
  }
  // Money that moves without being earned or spent, by what happened (DESIGN.md 9.2). A reversal's lines
  // are its original's with the signs flipped, so read by the original's type they take the band back out.
  for (const lines of events.values()) {
    const type = lines[0]!.type;
    const sign = type === 'reversal' ? -1n : 1n;
    const of = (pick: (f: Fact) => boolean) => lines.filter(pick).reduce((s, f) => s + f.amount, 0n);
    const kindIs = (k: LedgerKind) => (f: Fact) => look.kindOf(f.ledgerAccountId) === k;
    const cash = (f: Fact) => look.kindOf(f.ledgerAccountId) === 'asset' && look.isCash(f.ledgerAccountId);
    const nonCashAsset = (f: Fact) => look.kindOf(f.ledgerAccountId) === 'asset' && !look.isCash(f.ledgerAccountId);
    const t = type === 'reversal' ? (lines[0]!.reversedType ?? type) : type;
    switch (t) {
      case 'loan_proceeds':
        bump('borrowed', -of(kindIs('liability')));
        break;
      case 'loan_repayment':
        bump('debt_payments', of(kindIs('liability')));
        break;
      case 'lend':
        bump('lent', of(nonCashAsset));
        break;
      case 'collect':
        bump('collected', -of(nonCashAsset));
        break;
      case 'investment_buy':
        bump('investments', of(nonCashAsset));
        break;
      case 'investment_sell':
        bump('returns', -of(nonCashAsset));
        break;
      case 'salary_gross':
        // Pension and NHF are still your money: they go to investments, not spending.
        bump('investments', of(nonCashAsset));
        break;
      case 'transfer':
        // Both sides are the same size; a reversal's positive side is its original's negative one.
        if (opts.includeTransfers) bump('transfers', sign * of((f) => cash(f) && f.amount > 0n));
        break;
    }
  }
  if (opts.goalAllocations > 0n) bump('goals', opts.goalAllocations);

  const bands: CashFlowBand[] = [];
  for (const [categoryId, row] of byCategory) {
    if (row.amount === 0n) continue;
    const real = categoryId.startsWith('ledger:') ? null : categoryId;
    bands.push({
      key: `${row.kind}:${categoryId}`,
      side: row.kind === 'income' ? 'in' : 'out',
      kind: row.kind,
      categoryId: real,
      groupId: real ? look.groupOf(real) : null,
      amount: row.amount,
    });
  }
  const ins: CashFlowBand['kind'][] = ['borrowed', 'collected', 'returns', 'transfers'];
  const outs: CashFlowBand['kind'][] = ['goals', 'debt_payments', 'lent', 'investments', 'transfers'];
  for (const k of ins) {
    const v = other.get(k) ?? 0n;
    if (v > 0n) bands.push({ key: `in:${k}`, side: 'in', kind: k, categoryId: null, groupId: null, amount: v });
  }
  for (const k of outs) {
    const v = other.get(k) ?? 0n;
    if (v > 0n) bands.push({ key: `out:${k}`, side: 'out', kind: k, categoryId: null, groupId: null, amount: v });
  }
  const totalIn = bands.filter((b) => b.side === 'in').reduce((s, b) => s + b.amount, 0n);
  const totalOut = bands.filter((b) => b.side === 'out').reduce((s, b) => s + b.amount, 0n);
  const rest = totalIn - totalOut;
  if (rest > 0n)
    bands.push({ key: 'out:left_over', side: 'out', kind: 'left_over', categoryId: null, groupId: null, amount: rest });
  if (rest < 0n)
    bands.push({ key: 'in:shortfall', side: 'in', kind: 'shortfall', categoryId: null, groupId: null, amount: -rest });
  return bands;
}

