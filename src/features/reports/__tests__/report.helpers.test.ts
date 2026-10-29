import type { ReportResultWire } from '@/api/reports';

import { drillHref, reportCsv, viewResult } from '../helpers';

const sampleWire = (overrides: Partial<ReportResultWire> = {}): ReportResultWire => ({
  kind: 'spending_by_category',
  from: '2026-10-01',
  to: '2026-10-31',
  interval: 'month',
  chart: 'bar',
  unit: 'money',
  table: {
    columns: [{ key: 'total', label: 'Total' }],
    rows: [
      { key: 'fuel', label: 'Fuel', values: ['2500000'], total: '2500000' },
      { key: 'market', label: 'Market', values: ['1845000'], total: '1845000' },
    ],
    columnTotals: ['4345000'],
    total: '4345000',
  },
  previous: null,
  finding: { key: 'spending_rose', amount: '4345000', changeBasisPoints: '1200', previousFrom: '2026-09-01' },
  drill: {
    fuel: { from: '2026-10-01', to: '2026-10-31', categoryIds: ['cat-fuel'] },
    market: { from: '2026-10-01', to: '2026-10-31', categoryIds: ['cat-market'] },
  },
  partial: [],
  note: null,
  ...overrides,
});

describe('report helpers (P20)', () => {
  it('P20-02: table≡chart rows after wire parse, and CSV has every row + totals', () => {
    const view = viewResult(sampleWire());
    expect(view.table.total).toBe(4_345_000n);
    expect(view.table.rows.map((r) => r.total)).toEqual([2_500_000n, 1_845_000n]);
    const csv = reportCsv(view);
    expect(csv.split('\n')).toEqual(['Name,Total', 'Fuel,25000', 'Market,18450', 'Total,43450']);
  });

  it('P20-03: drill href opens Transactions with filters', () => {
    const view = viewResult(sampleWire());
    expect(drillHref(view.drill.fuel!)).toBe('/transactions?from=2026-10-01&to=2026-10-31&category=cat-fuel');
  });
});
