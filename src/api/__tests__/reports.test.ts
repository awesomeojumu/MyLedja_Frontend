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

describe('reportsApi.cashFlow', () => {
  it('calls GET …/cash-flow with from, to, accountIds and includeTransfers', async () => {
    const calls: { method: string; path: string }[] = [];
    const transport: Transport = async (req) => {
      calls.push({ method: req.method, path: req.path });
      return {
        status: 200,
        body: {
          from: '2026-10-01',
          to: '2026-10-31',
          bands: [],
          tiles: { in: '0', out: '0', savedBasisPoints: null },
          groups: [],
        },
      };
    };
    const client = new ApiClient(transport, createMemorySessionStore());
    await client.signedIn({ accessToken: 'test', refreshToken: 'r' }, false);
    const api = reportsApi(client);
    await api.cashFlow('ws-1', {
      from: '2026-10-01',
      to: '2026-10-31',
      accountIds: ['a1', 'a2'],
      includeTransfers: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.path).toContain('/v1/workspaces/ws-1/cash-flow?');
    expect(calls[0]!.path).toContain('from=2026-10-01');
    expect(calls[0]!.path).toContain('to=2026-10-31');
    expect(calls[0]!.path).toContain('accountIds=a1%2Ca2');
    expect(calls[0]!.path).toContain('includeTransfers=true');
  });
});
