import { createMemorySessionStore } from '@/data/session';

import { ApiClient, type Transport, type TransportRequest } from '../client';
import { reportsApi } from '../reports';

const noSleep = async () => {};

describe('reportsApi', () => {
  it('POSTs RunBody to …/reports/run', async () => {
    const calls: TransportRequest[] = [];
    const transport: Transport = async (req) => {
      calls.push(req);
      return {
        status: 200,
        body: {
          kind: 'spending_by_category',
          from: '2026-10-01',
          to: '2026-10-31',
          interval: 'month',
          chart: 'bar',
          unit: 'money',
          table: { columns: [], rows: [], columnTotals: [], total: '0' },
          previous: null,
          finding: null,
          drill: {},
          partial: [],
          note: null,
        },
      };
    };
    const api = reportsApi(new ApiClient(transport, createMemorySessionStore(), noSleep));
    await api.run('ws-1', { kind: 'spending_by_category', from: '2026-10-01', to: '2026-10-31', interval: 'month' });
    expect(calls.map((c) => ({ method: c.method, path: c.path, body: c.body }))).toEqual([
      {
        method: 'POST',
        path: '/v1/workspaces/ws-1/reports/run',
        body: { kind: 'spending_by_category', from: '2026-10-01', to: '2026-10-31', interval: 'month' },
      },
    ]);
  });
});
