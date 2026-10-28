import type { Snapshot } from '@/data/workspace/repository';
import { formatNaira } from '@/money';

export type ExportOptions = {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
};

/** Popup #24 — filtered CSV export (DESIGN page 11). */
export function exportTransactionsCsvFiltered(snapshot: Snapshot, opts: ExportOptions = {}): string {
  const payees = new Map(snapshot.payees.map((p) => [p.id, p.name]));
  const categories = new Map(snapshot.categories.map((c) => [c.id, c.name]));
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a.name]));
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const header = ['Date', 'Type', 'Payee', 'Category', 'Account', 'Amount', 'Notes'];
  const lines = [header.join(',')];
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type === 'opening_balance') continue;
    if (opts.dateFrom && e.date < opts.dateFrom) continue;
    if (opts.dateTo && e.date > opts.dateTo) continue;
    const money = e.lines.find((l) => accountIds.has(l.ledgerAccountId));
    if (opts.accountId && money?.ledgerAccountId !== opts.accountId) continue;
    const catLine = e.lines.find((l) => !accountIds.has(l.ledgerAccountId));
    const amount = money?.amountMinor ?? 0n;
    const row = [
      e.date,
      e.type,
      e.payeeId ? payees.get(e.payeeId) ?? '' : '',
      catLine ? categories.get(catLine.ledgerAccountId) ?? '' : '',
      money ? accounts.get(money.ledgerAccountId) ?? '' : '',
      formatNaira(amount, { signed: e.type !== 'transfer' }).replace(/,/g, ''),
      (e.notes ?? '').replace(/"/g, '""'),
    ];
    lines.push(row.map((c) => (c.includes(',') || c.includes('"') ? `"${c}"` : c)).join(','));
  }
  return lines.join('\n');
}
