import { Platform, Share } from 'react-native';

import { formatDay } from '@/design/components';
import type {
  RangePreset,
  ReportCardModel,
  ReportDashboardModel,
  ReportKind,
  SavedReportModel,
} from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { monthLabel } from '@/features/budget/helpers';
import { catalogue, t, type TextKey } from '@/i18n';
import { formatNaira, toInputText } from '@/money';

import { firstEventDate, rangeFor, runReport, type ReportResult } from './runner';

/** Gain/change as a signed percent from basis points. */
export function percentText(bp: bigint | null): string {
  if (bp === null) return '';
  const sign = bp > 0n ? '+' : bp < 0n ? '−' : '';
  const abs = bp < 0n ? -bp : bp;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0').slice(0, 1)}%`;
}

const formatMoney = (minor: bigint) => formatNaira(minor);

/** The Add report gallery's groups (DESIGN.md page 19). Custom also lists saved builder reports. */
export const GALLERY: { group: 'spending' | 'planning' | 'wealth' | 'custom'; kinds: ReportKind[] }[] = [
  { group: 'spending', kinds: ['spending_by_category', 'income_vs_expenses', 'spending_trends', 'transaction_calendar', 'summary_number'] },
  { group: 'planning', kinds: ['budget_analysis', 'balance_forecast', 'cash_flow', 'income_steadiness', 'age_of_money'] },
  { group: 'wealth', kinds: ['net_worth', 'investment_performance', 'debt_payoff', 'crossover'] },
  { group: 'custom', kinds: ['formula', 'note'] },
];

export const RANGE_PRESETS: RangePreset[] = ['this_month', 'last_month', 'last_3_months', 'this_year', 'last_12_months', 'all'];

/** A new card; it goes below the others, half width on web. */
export function newCard(id: string, kind: ReportKind, index: number, extra: Partial<ReportCardModel> = {}): ReportCardModel {
  return {
    id,
    kind,
    title: null,
    savedReportId: null,
    range: 'this_month',
    interval: 'month',
    chart: null,
    spec: null,
    formula: kind === 'formula' ? 'income - spending' : null,
    text: null,
    layout: { x: (index % 2) * 6, y: Math.floor(index / 2) * 4, w: 6, h: 4 },
    hidden: false,
    highlight: false,
    ...extra,
  };
}

/** The two dashboards everyone starts with, the same as the server's (TECH-SPEC 6.12). */
export function defaultDashboards(newId: () => string): Omit<ReportDashboardModel, 'id'>[] {
  const cards = (kinds: ReportKind[], range: RangePreset) => kinds.map((k, i) => newCard(newId(), k, i, { range }));
  return [
    { name: t('reports.overview'), sortOrder: 0, cards: cards(['net_worth', 'income_vs_expenses', 'spending_by_category', 'cash_flow'], 'this_month') },
    { name: t('reports.yearInReview'), sortOrder: 1, cards: cards(['income_vs_expenses', 'spending_by_category', 'net_worth', 'budget_analysis'], 'this_year') },
  ];
}

export function kindName(kind: ReportKind): string {
  return t(`reports.kind.${kind}` as TextKey);
}

export function cardTitle(card: ReportCardModel, saved: readonly SavedReportModel[]): string {
  if (card.title) return card.title;
  const report = card.savedReportId ? saved.find((s) => s.id === card.savedReportId) : null;
  return report?.name ?? kindName(card.kind);
}

/** Runs a card's report on the device's data, for its range. */
export function runCard(snapshot: Snapshot, card: ReportCardModel, onDate: string, override: Partial<{ from: string; to: string; compare: boolean }> = {}): ReportResult {
  const range = rangeFor(card.range, onDate, firstEventDate(snapshot));
  const saved = card.savedReportId ? snapshot.savedReports.find((s) => s.id === card.savedReportId) : null;
  const spec = saved?.spec ?? card.spec;
  return runReport(
    snapshot,
    {
      kind: card.kind,
      from: override.from ?? range.from,
      to: override.to ?? range.to,
      interval: card.interval,
      compare: override.compare,
      spec,
      formula: card.formula,
    },
    onDate,
  );
}

export function rangeCaption(from: string, to: string): string {
  return t('reports.rangeCaption', { from: formatDay(from), to: formatDay(to) });
}

/** A row's name: months, weeks and days as dates, "None" for lines without one. */
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

/** One value, as the report's unit reads. */
export function valueText(value: bigint, unit: ReportResult['unit']): string {
  switch (unit) {
    case 'money':
      return formatMoney(value);
    case 'count':
      return String(value);
    case 'days':
      return t('reports.days', { n: String(value) });
    case 'basis_points':
      return percentText(value).replace('+', '');
  }
}

/** The chart's title states what it found (DESIGN.md 2.7). */
export function findingText(result: ReportResult, fallback: string): string {
  const f = result.finding;
  if (!f) return fallback;
  const key = `reports.finding.${f.key}`;
  if (!(key in catalogue)) return fallback;
  const change = f.changeBasisPoints === null ? '' : percentText(f.changeBasisPoints < 0n ? -f.changeBasisPoints : f.changeBasisPoints).replace('+', '');
  return t(key as TextKey, {
    amount: f.amount === null ? '' : valueText(f.amount, result.unit),
    change,
    month: f.previousFrom ? monthLabel(f.previousFrom.slice(0, 7)) : '',
  });
}

const cell = (v: string) => {
  // A cell that starts like a formula is kept as text (the same guard as the transactions export).
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The table as CSV: every number the chart shows, with totals (P20-02). */
export function reportCsv(result: ReportResult): string {
  const plain = (v: bigint) => (result.unit === 'money' ? toInputText(v) : String(v));
  // One column is the total itself; more are shown each, then the total.
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

/** The Transactions link for a row (P20-03). */
export function drillHref(d: ReportResult['drill'][string]): string {
  const q = new URLSearchParams({ from: d.from, to: d.to });
  if (d.accountId) q.set('account', d.accountId);
  if (d.categoryId) q.set('category', d.categoryId);
  if (d.payeeId) q.set('payee', d.payeeId);
  return `/transactions?${q.toString()}`;
}

/** Keeps the one gold highlight per dashboard (P19-05). */
export function setHighlight(cards: ReportCardModel[], id: string): ReportCardModel[] {
  return cards.map((c) => ({ ...c, highlight: c.id === id ? !c.highlight : false }));
}

/** Moves a card up or down in edit layout, keeping the grid tidy. */
export function moveCard(cards: ReportCardModel[], id: string, by: -1 | 1): ReportCardModel[] {
  const i = cards.findIndex((c) => c.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= cards.length) return cards;
  const next = [...cards];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return relayout(next);
}

/** Rows of 12 columns, in order, each card keeping its width. */
export function relayout(cards: ReportCardModel[]): ReportCardModel[] {
  let x = 0;
  let y = 0;
  let rowH = 0;
  return cards.map((c) => {
    const w = Math.min(12, Math.max(3, c.layout.w));
    if (x + w > 12) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    const placed = { ...c, layout: { ...c.layout, x, y, w } };
    x += w;
    rowH = Math.max(rowH, c.layout.h);
    return placed;
  });
}
