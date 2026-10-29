import { createMemorySessionStore } from '@/data/session';

import { ApiClient, type Transport } from '../client';
import { reportsApi } from '../reports';

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
