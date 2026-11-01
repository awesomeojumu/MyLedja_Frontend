import { createMemorySessionStore } from '@/data/session';

import { ApiClient } from '../../client';
import { reportsApi, type RunReportBody } from '../../reports';
import { createAuthMock } from '../auth';
import { mockRunReport } from '../reports';

const body = (extra: Partial<RunReportBody> = {}): RunReportBody => ({
  kind: 'custom',
  from: '2026-10-01',
  to: '2026-10-31',
  interval: 'month',
  compare: true,
  filters: {},
  spec: { show: 'spending', groupBy: 'payee', splitBy: null, chart: 'bar', filters: {} },
  ...extra,
});

describe('mockRunReport', () => {
  it('builds Spending by payee (custom + groupBy payee) with payee rows', () => {
    const wire = mockRunReport(body());
    expect(wire.kind).toBe('custom');
    expect(wire.chart).toBe('bar');
    expect(wire.table.rows.map((r) => r.label)).toEqual(['Shoprite', 'Total Energies', 'MTN']);
    expect(wire.table.total).not.toBe('0');
    expect(wire.previous).not.toBeNull();
    expect(wire.drill['payee-shoprite']).toMatchObject({ payeeIds: ['payee-shoprite'] });
  });

  it('builds spending_by_category with category rows', () => {
    const wire = mockRunReport(body({ kind: 'spending_by_category', spec: undefined }));
    expect(wire.chart).toBe('donut');
    expect(wire.table.rows.length).toBeGreaterThan(0);
  });
});

describe('createAuthMock reports/run', () => {
  it('answers POST …/reports/run for Spending by payee so Mock never 404s', async () => {
    const { transport } = createAuthMock();
    const client = new ApiClient(transport, createMemorySessionStore(), async () => {});
    await client.signedIn({ accessToken: 'a', refreshToken: 'r' }, false);
    const wire = await reportsApi(client).run('ws-personal', body());
    expect(wire.table.rows.map((r) => r.key)).toEqual(['payee-shoprite', 'payee-total', 'payee-mtn']);
  });
});
