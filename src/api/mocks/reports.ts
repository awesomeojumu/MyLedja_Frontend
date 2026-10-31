import type { TransportRequest, TransportResponse } from '../client';
import type { ReportChart, ReportKind, ReportResultWire, ReportUnit, RunReportBody } from '../reports';

type TableRow = { key: string; label: string; values: string[]; total: string };

function table(rows: TableRow[], columns = [{ key: 'total', label: 'Total' }]): ReportResultWire['table'] {
  const columnTotals = columns.map((_, i) =>
    String(rows.reduce((sum, r) => sum + BigInt(r.values[i] ?? '0'), 0n)),
  );
  const total = String(rows.reduce((sum, r) => sum + BigInt(r.total), 0n));
  return { columns, rows, columnTotals, total };
}

function result(
  body: RunReportBody,
  chart: ReportChart,
  unit: ReportUnit,
  rows: TableRow[],
  previousRows?: TableRow[],
  findingKey = 'spending_rose',
): ReportResultWire {
  const tbl = table(rows);
  const previous = previousRows
    ? table(previousRows)
    : null;
  return {
    kind: body.kind,
    from: body.from,
    to: body.to,
    interval: body.interval ?? 'month',
    chart,
    unit,
    table: tbl,
    previous,
    finding: previous
      ? {
          key: findingKey,
          amount: tbl.total,
          changeBasisPoints: '-1600',
          previousFrom: previousRows ? shiftBack(body.from) : null,
        }
      : null,
    drill: Object.fromEntries(
      rows.map((r) => [
        r.key,
        {
          from: body.from,
          to: body.to,
          ...(body.spec?.groupBy === 'payee' || r.key.startsWith('payee-')
            ? { payeeIds: [r.key] }
            : { categoryIds: [r.key] }),
        },
      ]),
    ),
    partial: [],
    note: null,
  };
}

function shiftBack(from: string): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

const CATEGORY_ROWS: TableRow[] = [
  { key: 'cat-fuel', label: 'Fuel', values: ['2500000'], total: '2500000' },
  { key: 'cat-market', label: 'Market', values: ['1845000'], total: '1845000' },
  { key: 'cat-airtime', label: 'Airtime', values: ['500000'], total: '500000' },
];

const CATEGORY_PREV: TableRow[] = [
  { key: 'cat-fuel', label: 'Fuel', values: ['1000000'], total: '1000000' },
  { key: 'cat-market', label: 'Market', values: ['2200000'], total: '2200000' },
  { key: 'cat-airtime', label: 'Airtime', values: ['400000'], total: '400000' },
];

const PAYEE_ROWS: TableRow[] = [
  { key: 'payee-shoprite', label: 'Shoprite', values: ['3200000'], total: '3200000' },
  { key: 'payee-total', label: 'Total Energies', values: ['2500000'], total: '2500000' },
  { key: 'payee-mtn', label: 'MTN', values: ['500000'], total: '500000' },
];

const PAYEE_PREV: TableRow[] = [
  { key: 'payee-shoprite', label: 'Shoprite', values: ['2800000'], total: '2800000' },
  { key: 'payee-total', label: 'Total Energies', values: ['2100000'], total: '2100000' },
  { key: 'payee-mtn', label: 'MTN', values: ['450000'], total: '450000' },
];

const INCOME_SPEND_ROWS: TableRow[] = [
  { key: '2026-10', label: '2026-10', values: ['450000000', '4845000'], total: '445155000' },
  { key: '2026-09', label: '2026-09', values: ['450000000', '3600000'], total: '446400000' },
];

const NET_WORTH_ROWS: TableRow[] = [
  { key: 'assets', label: 'Assets', values: ['81230000'], total: '81230000' },
  { key: 'debts', label: 'Debts', values: ['0'], total: '0' },
];

/** Builds a demo ReportResult for the mock API adapter (dev Mock source). */
export function mockRunReport(body: RunReportBody): ReportResultWire {
  const kind: ReportKind = body.kind;
  const groupBy = body.spec?.groupBy;

  if (kind === 'custom' && groupBy === 'payee') {
    return result(body, body.spec?.chart ?? 'bar', 'money', PAYEE_ROWS, body.compare === false ? undefined : PAYEE_PREV);
  }
  if (kind === 'custom') {
    const chart = body.spec?.chart ?? 'bar';
    if (groupBy === 'month' || body.spec?.splitBy === 'month') {
      return result(body, chart, 'money', INCOME_SPEND_ROWS.map((r) => ({ key: r.key, label: r.label, values: [r.values[1] ?? '0'], total: r.values[1] ?? '0' })), CATEGORY_PREV);
    }
    return result(body, chart, 'money', CATEGORY_ROWS, body.compare === false ? undefined : CATEGORY_PREV);
  }
  if (kind === 'spending_by_category' || kind === 'spending_trends') {
    return result(body, kind === 'spending_trends' ? 'line' : 'donut', 'money', CATEGORY_ROWS, body.compare === false ? undefined : CATEGORY_PREV);
  }
  if (kind === 'income_vs_expenses') {
    const columns = [
      { key: 'income', label: 'Income' },
      { key: 'spending', label: 'Spending' },
    ];
    const tbl = table(INCOME_SPEND_ROWS, columns);
    return {
      kind: body.kind,
      from: body.from,
      to: body.to,
      interval: body.interval ?? 'month',
      chart: 'bar',
      unit: 'money',
      table: tbl,
      previous: null,
      finding: { key: 'net_rose', amount: tbl.total, changeBasisPoints: '200', previousFrom: shiftBack(body.from) },
      drill: {},
      partial: [],
      note: null,
    };
  }
  if (kind === 'net_worth') {
    return result(body, 'area', 'money', NET_WORTH_ROWS);
  }
  // Remaining kinds: empty-but-valid so Mock never 404s a report open.
  return result(body, 'table', 'money', []);
}

/** Mock answers for POST …/reports/run so Report screens work with the mock adapter. */
export function createReportsMock() {
  const ok = (body: unknown): TransportResponse => ({ status: 200, body });

  return (req: TransportRequest): TransportResponse | null => {
    const path = req.path.split('?')[0] ?? req.path;
    const run = path.match(/^\/v1\/workspaces\/[^/]+\/reports\/run$/);
    if (req.method === 'POST' && run) {
      const body = (req.body ?? {}) as RunReportBody;
      if (!body.kind || !body.from || !body.to) {
        return { status: 400, body: { code: 'validation_failed', message: 'kind, from and to are required' } };
      }
      return ok(mockRunReport(body));
    }
    return null;
  };
}
