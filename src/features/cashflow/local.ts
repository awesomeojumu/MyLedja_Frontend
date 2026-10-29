import { ACCOUNT_KIND_INFO } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

import { cashFlow, type CashFlowBand, type Fact, type Lookup } from './engine';

const CASH_TYPES = new Set(['bank', 'savings', 'cash', 'wallet', 'card']);

/** Names and kinds for the cash-flow engine, from this device's copy. */
export function lookupOf(snapshot: Snapshot): Lookup {
  const categories = new Map(snapshot.categories.map((c) => [c.id, c]));
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a]));
  return {
    kindOf: (id) => snapshot.chart.get(id)?.kind ?? null,
    categoryOf: (id) => snapshot.chart.get(id)?.categoryId ?? null,
    groupOf: (c) => categories.get(c)?.group ?? null,
    isCash: (id) => {
      const a = accounts.get(id);
      return !!a && CASH_TYPES.has(a.type);
    },
  };
}

/** Every line of every event in the workspace copy. */
export function factsOf(snapshot: Snapshot): Fact[] {
  const typeOf = new Map(snapshot.events.map((e) => [e.id, e.type]));
  return snapshot.events.flatMap((e) => {
    const holdingIds = new Set(snapshot.holdings.map((h) => h.ledgerAccountId));
    const accountIds = e.lines
      .map((l) => l.ledgerAccountId)
      .filter((id) => {
        const a = snapshot.chart.get(id);
        return !!a && (a.kind === 'asset' || a.kind === 'liability') && !a.system && !holdingIds.has(id);
      });
    return e.lines.map((l) => ({
      eventId: e.id,
      date: e.date,
      type: e.type,
      ledgerAccountId: l.ledgerAccountId,
      amount: l.amountMinor,
      payeeId: e.payeeId ?? null,
      tagIds: [] as string[],
      accountIds,
      reversed: e.status === 'reversed',
      reversedType: e.reversalOf ? (typeOf.get(e.reversalOf) ?? null) : null,
    }));
  });
}

/** Cash flow bands for a range on the device (DESIGN.md page 22 / TECH-SPEC 6.12). */
export function cashFlowFor(
  snapshot: Snapshot,
  q: { from: string; to: string; accountIds?: string[]; includeTransfers: boolean },
): CashFlowBand[] {
  const facts = factsOf(snapshot).filter((f) => f.date >= q.from && f.date <= q.to);
  const goals = snapshot.allocations
    .filter((a) => a.kind !== 'spend' && a.date >= q.from && a.date <= q.to)
    .filter((a) => !q.accountIds?.length || q.accountIds.includes(a.fromAccountId))
    .reduce((s, a) => s + BigInt(a.amountMinor), 0n);
  return cashFlow(facts, lookupOf(snapshot), {
    goalAllocations: goals,
    includeTransfers: q.includeTransfers,
    accountIds: q.accountIds,
  });
}

/** Accounts money is spent from, for the accounts filter. */
export function spendingAccounts(snapshot: Snapshot) {
  return snapshot.accounts.filter((a) => !a.archived && ACCOUNT_KIND_INFO[a.type].ledger === 'asset');
}
