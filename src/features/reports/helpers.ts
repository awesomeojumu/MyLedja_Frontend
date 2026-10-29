import { Platform, Share } from 'react-native';

import { formatDay } from '@/design/components';
import type { ReportCardKind } from '@/data/workspace/model';
import { monthLabel } from '@/features/budget/helpers';
import { catalogue, t, type TextKey } from '@/i18n';
import { formatNaira, fromWire, toInputText } from '@/money';

import type { ReportFilters, ReportResultWire, ReportTableWire, ReportUnit } from '@/api/reports';

export type ViewRow = { key: string; label: string; values: bigint[]; total: bigint };

export type ViewTable = {
  columns: { key: string; label: string }[];
  rows: ViewRow[];
  columnTotals: bigint[];
  total: bigint;
};

/** FE view of a run result: wire strings → bigint for charts (DESIGN charts use bigint). */
export type ViewReportResult = Omit<ReportResultWire, 'table' | 'previous' | 'finding'> & {
  table: ViewTable;
  previous: ViewTable | null;
  finding: {
    key: string;
    amount: bigint | null;
    changeBasisPoints: bigint | null;
    previousFrom: string | null;
  } | null;
};

function parseTable(table: ReportTableWire): ViewTable {
  return {
    columns: table.columns,
    rows: table.rows.map((r) => ({
      key: r.key,
      label: r.label,
      values: r.values.map((v) => fromWire(v)),
      total: fromWire(r.total),
    })),
    columnTotals: table.columnTotals.map((v) => fromWire(v)),
    total: fromWire(table.total),
  };
}

export function viewResult(wire: ReportResultWire): ViewReportResult {
  return {
    ...wire,
    table: parseTable(wire.table),
    previous: wire.previous ? parseTable(wire.previous) : null,
    finding: wire.finding
      ? {
          key: wire.finding.key,
          amount: wire.finding.amount === null ? null : fromWire(wire.finding.amount),
          changeBasisPoints: wire.finding.changeBasisPoints === null ? null : fromWire(wire.finding.changeBasisPoints),
          previousFrom: wire.finding.previousFrom,
        }
      : null,
  };
}

export function rangeCaption(from: string, to: string): string {
  return t('reports.rangeCaption', { from: formatDay(from), to: formatDay(to) });
}

export function rowLabel(row: { key: string; label: string }): string {
  if (row.key === 'none') return t('reports.none');
  if (/^\d{4}-\d{2}$/.test(row.key)) return monthLabel(row.key);
  if (/^\d{4}-\d{2}-\d{2}$/.test(row.key)) return formatDay(row.key);
  if (row.label in catalogue) return t(row.label as TextKey);
  return row.label || row.key;
}

export function columnLabel(key: string): string {
  const k = `reports.col.${key}`;
  return k in catalogue ? t(k as TextKey) : rowLabel({ key, label: key });
}

export function valueText(value: bigint, unit: ReportUnit): string {
  switch (unit) {
    case 'money':
      return formatNaira(value);
    case 'count':
      return String(value);
    case 'days':
      return t('reports.days', { n: String(value) });
    case 'basis_points': {
      const abs = value < 0n ? -value : value;
      const whole = abs / 100n;
      const frac = abs % 100n;
      const body = frac === 0n ? `${whole}%` : `${whole}.${frac.toString().padStart(2, '0')}%`;
      return value < 0n ? `-${body}` : body;
    }
  }
}

export function findingText(result: ViewReportResult, fallback: string): string {
  const f = result.finding;
  if (!f) return fallback;
  const key = `reports.finding.${f.key}`;
  if (!(key in catalogue)) return fallback;
  const change =
    f.changeBasisPoints === null
      ? ''
      : valueText(f.changeBasisPoints < 0n ? -f.changeBasisPoints : f.changeBasisPoints, 'basis_points').replace('+', '');
  return t(key as TextKey, {
    amount: f.amount === null ? '' : valueText(f.amount, result.unit),
    change,
    month: f.previousFrom ? monthLabel(f.previousFrom.slice(0, 7)) : '',
  });
}

const cell = (v: string) => {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Table as CSV: every number the chart shows, with totals (P20-02 / P20-04). */
export function reportCsv(result: ViewReportResult): string {
  const plain = (v: bigint) => (result.unit === 'money' ? toInputText(v) : String(v));
  const multi = result.table.columns.length > 1;
  const head = [t('reports.col.name'), ...(multi ? result.table.columns.map((c) => columnLabel(c.key)) : []), t('reports.col.total')];
  const rows = result.table.rows.map((r) => [rowLabel(r), ...(multi ? r.values.map(plain) : []), plain(r.total)]);
  const totals = [t('reports.col.total'), ...(multi ? result.table.columnTotals.map(plain) : []), plain(result.table.total)];
  return [head, ...rows, totals].map((r) => r.map(cell).join(',')).join('\n');
}

export async function shareCsv(csv: string, name: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await Share.share({ message: csv, title: name });
  }
}

/** Transactions link for a row (P20-03). BE drill uses filter arrays. */
export function drillHref(d: ReportFilters & { from: string; to: string }): string {
  const q = new URLSearchParams({ from: d.from, to: d.to });
  const account = d.accountIds?.[0];
  const category = d.categoryIds?.[0];
  const payee = d.payeeIds?.[0];
  if (account) q.set('account', account);
  if (category) q.set('category', category);
  if (payee) q.set('payee', payee);
  return `/transactions?${q.toString()}`;
}

export function aboutKey(kind: ReportCardKind): TextKey {
  const k = `reports.about.${kind}` as TextKey;
  return k in catalogue ? k : (`reports.about.${kind}` as TextKey);
}
