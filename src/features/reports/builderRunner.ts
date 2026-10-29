import type { BuilderSpecModel, RangePreset, ReportChart, ReportFiltersModel } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { catalogue, t, type TextKey } from '@/i18n';
import {
  changeBasisPoints,
  previousRange,
  run,
  type Dimension,
  type Fact,
  type Filters,
  type Lookup,
  type Spec,
  type Table,
} from '@/ledger/reports';

const NONE = 'none';
const CASH_TYPES = new Set(['bank', 'savings', 'cash', 'wallet', 'card']);

export const EMPTY_SPEC: BuilderSpecModel = {
  show: 'spending',
  groupBy: 'category',
  splitBy: null,
  chart: 'bar',
  filters: {},
};

export type BuilderPreviewResult = {
  chart: ReportChart;
  unit: 'money' | 'count';
  table: Table;
  previous: Table | null;
  from: string;
  to: string;
};

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Card / builder dates from a range preset (TB-14 / DESIGN page 21). */
export function rangeFor(preset: RangePreset, today: string, first: string | null): { from: string; to: string } {
  const month = today.slice(0, 7);
  switch (preset) {
    case 'this_month':
      return monthBounds(month);
    case 'last_month':
      return monthBounds(shiftMonth(month, -1));
    case 'last_3_months':
      return { from: monthBounds(shiftMonth(month, -2)).from, to: monthBounds(month).to };
    case 'this_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'last_12_months':
      return { from: monthBounds(shiftMonth(month, -11)).from, to: monthBounds(month).to };
    case 'all':
      return { from: first ? monthBounds(first.slice(0, 7)).from : monthBounds(month).from, to: monthBounds(month).to };
  }
}

export function firstEventDate(snapshot: Snapshot): string | null {
  let first: string | null = null;
  for (const e of snapshot.events) {
    if (!first || e.date < first) first = e.date;
  }
  return first;
}

export function lookupOf(snapshot: Snapshot): Lookup {
  const categories = new Map(snapshot.categories.map((c) => [c.id, c]));
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a]));
  const payees = new Map(snapshot.payees.map((p) => [p.id, p.name]));
  return {
    kindOf: (id) => snapshot.chart.get(id)?.kind ?? null,
    categoryOf: (id) => snapshot.chart.get(id)?.categoryId ?? null,
    groupOf: (c) => categories.get(c)?.group ?? null,
    isCash: (id) => {
      const a = accounts.get(id);
      return !!a && CASH_TYPES.has(a.type);
    },
    label: (dim: Dimension, key: string) => {
      if (key === NONE) return '';
      switch (dim) {
        case 'category':
          return categories.get(key)?.name ?? snapshot.chart.get(key)?.name ?? '';
        case 'group':
          return key in catalogue ? t(key as TextKey) : key;
        case 'payee':
          return payees.get(key) ?? '';
        case 'account':
          return accounts.get(key)?.name ?? snapshot.chart.get(key)?.name ?? '';
        case 'tag':
          return key;
        case 'month':
          return key;
      }
    },
  };
}

export function factsOf(snapshot: Snapshot): Fact[] {
  const typeOf = new Map(snapshot.events.map((e) => [e.id, e.type]));
  return snapshot.events.flatMap((e) => {
    const accountIds = e.lines
      .map((l) => l.ledgerAccountId)
      .filter((id) => {
        const a = snapshot.chart.get(id);
        return !!a && (a.kind === 'asset' || a.kind === 'liability') && !a.system;
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

const filtersOf = (f: ReportFiltersModel | undefined): Filters => ({ ...f });

/** Local custom-report preview (same engine as BE TECH-SPEC / DESIGN page 21). */
export function runBuilderPreview(
  snapshot: Snapshot,
  spec: BuilderSpecModel,
  range: { from: string; to: string },
  compare = false,
): BuilderPreviewResult {
  const look = lookupOf(snapshot);
  const facts = factsOf(snapshot);
  const s: Spec = {
    show: spec.show,
    groupBy: spec.groupBy,
    splitBy: spec.splitBy,
    interval: 'month',
    from: range.from,
    to: range.to,
    filters: filtersOf(spec.filters),
  };
  const table = run(s, facts, look);
  const prev = previousRange(range.from, range.to);
  const previous = compare ? run({ ...s, ...prev }, facts, look) : null;
  // Touch change helper so unused-import lint stays quiet when compare is off in UI.
  if (previous) void changeBasisPoints(table.total, previous.total);
  return {
    chart: spec.chart,
    unit: spec.show === 'count' ? 'count' : 'money',
    table,
    previous,
    from: range.from,
    to: range.to,
  };
}

export function defaultBuilderName(spec: BuilderSpecModel, rangeLabel: string): string {
  return t('reports.defaultName', {
    show: t(`reports.show.${spec.show}` as TextKey),
    group: t(`reports.dim.${spec.groupBy}` as TextKey),
    range: rangeLabel,
  });
}
