import type { DateFormat, ImportMapping } from '@/data/workspace/model';
import type { TxEvent } from '@/data/workspace/repository';

/** RFC 4180 style: quoted fields may hold commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

export function parseDate(value: string, format: DateFormat): string | null {
  const parts = value.trim().split(/[/.\-\s]+/);
  if (parts.length < 3) return null;
  const [a, b, c] = parts as [string, string, string];
  const [y, m, d] = format === 'YYYY-MM-DD' ? [a, b, c] : format === 'DD/MM/YYYY' ? [c, b, a] : [c, a, b];
  const year = y.length === 2 ? `20${y}` : y;
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) return null;
  const iso = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const check = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(check.getTime()) && check.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Bank amounts to signed kobo: "₦1,234.50", "-1234.5", "(1,234.50)" and "1234.50 DR" all work. No floats touch the value. */
export function parseAmount(value: string): bigint | null {
  let s = value.trim().replace(/[₦,\s]|NGN/gi, '');
  if (s === '') return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/DR$/i.test(s)) {
    negative = true;
    s = s.slice(0, -2);
  } else if (/CR$/i.test(s)) s = s.slice(0, -2);
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const minor = BigInt(m[1] ?? '0') * 100n + BigInt((m[2] ?? '').padEnd(2, '0') || '0');
  return negative ? -minor : minor;
}

export type ParsedRow = {
  line: number;
  date: string;
  amount: bigint;
  description: string;
  payee: string;
  notes: string;
};

export type BrokenRow = { line: number; reason: 'date' | 'amount' };

export function guessMapping(header: string[] | undefined, saved?: ImportMapping): ImportMapping {
  if (saved) return saved;
  const find = (...words: string[]) => {
    const i = (header ?? []).findIndex((h) => words.some((w) => h.toLowerCase().includes(w)));
    return i < 0 ? null : i;
  };
  const moneyIn = find('credit', 'money in', 'deposit');
  const moneyOut = find('debit', 'money out', 'withdrawal');
  const split = moneyIn !== null && moneyOut !== null;
  return {
    date: find('date') ?? 0,
    amount: split ? null : (find('amount') ?? 1),
    moneyIn: split ? moneyIn : null,
    moneyOut: split ? moneyOut : null,
    description: find('description', 'narration', 'details', 'remark'),
    payee: find('payee', 'merchant', 'beneficiary'),
    notes: find('note', 'memo'),
    dateFormat: 'DD/MM/YYYY',
    hasHeader: header !== undefined,
  };
}

export function readRows(table: string[][], mapping: ImportMapping): { rows: ParsedRow[]; broken: BrokenRow[] } {
  const rows: ParsedRow[] = [];
  const broken: BrokenRow[] = [];
  const start = mapping.hasHeader ? 1 : 0;
  const cell = (r: string[], i: number | null) => (i === null ? '' : (r[i] ?? '').trim());
  table.slice(start).forEach((r, i) => {
    const line = i + start + 1;
    const date = parseDate(cell(r, mapping.date), mapping.dateFormat);
    if (!date) {
      broken.push({ line, reason: 'date' });
      return;
    }
    let amount: bigint | null;
    if (mapping.amount !== null) amount = parseAmount(cell(r, mapping.amount));
    else {
      const inn = cell(r, mapping.moneyIn) ? parseAmount(cell(r, mapping.moneyIn)) : 0n;
      const out = cell(r, mapping.moneyOut) ? parseAmount(cell(r, mapping.moneyOut)) : 0n;
      amount = inn === null || out === null ? null : (inn < 0n ? -inn : inn) - (out < 0n ? -out : out);
    }
    if (amount === null || amount === 0n) {
      broken.push({ line, reason: 'amount' });
      return;
    }
    const description = cell(r, mapping.description);
    rows.push({ line, date, amount, description, payee: cell(r, mapping.payee) || description, notes: cell(r, mapping.notes) });
  });
  return { rows, broken };
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );

/** Two descriptions are similar if one contains the other, or they share at least half their words. */
export function similar(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const wa = words(x);
  const wb = words(y);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared > 0 && shared * 2 >= Math.min(wa.size, wb.size);
}

const dayGap = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;

/** B1.12: same account, same amount, dates within 3 days, similar description. */
export function isDuplicate(row: ParsedRow, accountId: string, events: TxEvent[], payeeNames: Map<string, string>): boolean {
  return events.some((e) => {
    if (e.status !== 'posted' || e.type === 'reversal') return false;
    const line = e.lines.find((l) => l.ledgerAccountId === accountId);
    if (!line || line.amountMinor !== row.amount || dayGap(e.date, row.date) > 3) return false;
    const label = [e.payeeId ? payeeNames.get(e.payeeId) : '', e.notes ?? ''].join(' ');
    return similar(label, row.description || row.payee) || similar(label, row.payee);
  });
}
