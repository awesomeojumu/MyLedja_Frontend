import type { Snapshot, TxEvent } from '@/data/workspace/repository';

function transferAmount(snapshot: Snapshot, e: TxEvent): bigint {
  const accounts = new Set(snapshot.accounts.map((a) => a.id));
  return e.lines.find((l) => accounts.has(l.ledgerAccountId) && l.amountMinor > 0n)?.amountMinor ?? 0n;
}

export function duplicateTransferPairs(snapshot: Snapshot): { a: TxEvent; b: TxEvent; amount: bigint }[] {
  const transfers = snapshot.events.filter((e) => e.status === 'posted' && e.type === 'transfer');
  const pairs: { a: TxEvent; b: TxEvent; amount: bigint }[] = [];
  for (let i = 0; i < transfers.length; i += 1) {
    for (let j = i + 1; j < transfers.length; j += 1) {
      const a = transfers[i]!;
      const b = transfers[j]!;
      if (a.date !== b.date) continue;
      const amtA = transferAmount(snapshot, a);
      const amtB = transferAmount(snapshot, b);
      if (amtA > 0n && amtA === amtB) pairs.push({ a, b, amount: amtA });
    }
  }
  return pairs;
}
