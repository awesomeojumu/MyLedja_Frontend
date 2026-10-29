import type { Snapshot } from '@/data/workspace/repository';
import { formatNairaStatement } from '@/money';

import { parseTags } from './tags';

export type ExportColumn = 'date' | 'payee' | 'category' | 'account' | 'amount' | 'notes' | 'tags' | 'type' | 'status';

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = ['date', 'payee', 'category', 'account', 'amount', 'notes', 'type', 'status'];

export type ExportOptions = {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  columns?: ExportColumn[];
  /** Escape leading = + - @ so spreadsheets treat cells as text (PU24-2). */
  safeFormulas?: boolean;
};

const HEADERS: Record<ExportColumn, string> = {
  date: 'Date',
  payee: 'Payee',
  category: 'Category',
  account: 'Account',
  amount: 'Amount',
  notes: 'Notes',
  tags: 'Tags',
  type: 'Type',
  status: 'Status',
};

/** Popup #24 — filtered CSV export (DESIGN page 11 / addendum PU-24). */
export function exportTransactionsCsvFiltered(snapshot: Snapshot, opts: ExportOptions = {}): string {
  const columns = opts.columns?.length ? opts.columns : DEFAULT_EXPORT_COLUMNS;
  const payees = new Map(snapshot.payees.map((p) => [p.id, p.name]));
  const categories = new Map(snapshot.categories.map((c) => [c.id, c.name]));
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a.name]));
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const lines = [columns.map((c) => HEADERS[c]).join(',')];
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type === 'opening_balance') continue;
    if (opts.dateFrom && e.date < opts.dateFrom) continue;
    if (opts.dateTo && e.date > opts.dateTo) continue;
    const money = e.lines.find((l) => accountIds.has(l.ledgerAccountId));
    if (opts.accountId && money?.ledgerAccountId !== opts.accountId) continue;
    const catLine = e.lines.find((l) => !accountIds.has(l.ledgerAccountId));
    const amount = money?.amountMinor ?? 0n;
    const tags = parseTags(e.notes).join(';');
    const notesBody = (e.notes ?? '').replace(/^receipt:[^\n]*\n?/, '').replace(/^tags:[^\n]*\n?/, '').trim();
    const values: Record<ExportColumn, string> = {
      date: e.date,
      payee: e.payeeId ? payees.get(e.payeeId) ?? '' : '',
      category: catLine ? categories.get(catLine.ledgerAccountId) ?? '' : '',
      account: money ? accounts.get(money.ledgerAccountId) ?? '' : '',
      amount: formatNairaStatement(amount).replace(/,/g, ''),
      notes: notesBody.replace(/"/g, '""'),
      tags,
      type: e.type,
      status: e.status,
    };
    const cells = columns.map((c) => {
      let cell = values[c];
      if (opts.safeFormulas !== false && /^[=+\-@]/.test(cell)) cell = `'${cell}`;
      return cell.includes(',') || cell.includes('"') || cell.includes('\n') ? `"${cell}"` : cell;
    });
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}
