import { ACCOUNT_KIND_INFO, type Account } from '@/data/workspace/model';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';

export type TransferMatchPair = {
  out: TxEvent;
  in: TxEvent;
  amount: bigint;
  daysApart: number;
};

export function pairKey(outId: string, inId: string): string {
  return `${outId}:${inId}`;
}

function daysApart(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`));
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Effect on a real account as shown (liabilities flip sign). */
function shownOnAccount(account: Account, amountMinor: bigint): bigint {
  return ACCOUNT_KIND_INFO[account.type].ledger === 'liability' ? -amountMinor : amountMinor;
}

/**
 * Opposite legs that look like a transfer: money left one of my accounts and the same
 * amount arrived in another within 3 days (DESIGN Transfer match / P11-09 / BE suggestions).
 */
export function transferMatchCandidates(snapshot: Snapshot, dismissed: Set<string> = new Set()): TransferMatchPair[] {
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a]));
  const live = snapshot.events.filter((e) => e.status === 'posted' && e.type !== 'reversal' && e.type !== 'transfer');
  type Leg = { event: TxEvent; accountId: string; amount: bigint };
  const outs: Leg[] = [];
  const inns: Leg[] = [];

  for (const event of live) {
    const real = event.lines.filter((l) => accounts.has(l.ledgerAccountId));
    if (real.length !== 1) continue;
    const line = real[0]!;
    const account = accounts.get(line.ledgerAccountId)!;
    const shown = shownOnAccount(account, line.amountMinor);
    if (shown < 0n) outs.push({ event, accountId: account.id, amount: -shown });
    if (shown > 0n) inns.push({ event, accountId: account.id, amount: shown });
  }

  const pairs: TransferMatchPair[] = [];
  for (const out of outs) {
    for (const inn of inns) {
      if (out.accountId === inn.accountId) continue;
      if (out.amount !== inn.amount) continue;
      if (dismissed.has(pairKey(out.event.id, inn.event.id))) continue;
      const days = daysApart(out.event.date, inn.event.date);
      if (days > 3) continue;
      pairs.push({ out: out.event, in: inn.event, amount: out.amount, daysApart: days });
    }
  }
  return pairs;
}
