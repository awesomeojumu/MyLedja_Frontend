import { localFromServer, recurrenceFromServer, recurrenceToServer, scheduleBody } from '../serverRecords';

describe('server records into local records (Phase 2 join)', () => {
  it('maps transaction lines onto the app chart: accounts, categories and system accounts', () => {
    const rec = localFromServer(
      'transactions',
      't1',
      {
        id: 't1',
        type: 'opening_balance',
        date: '2026-10-01',
        lines: [
          { ledgerAccountId: 'la-bank', accountId: 'acc-bank', categoryId: null, system: null, amount: '81230000', currency: 'NGN' },
          { ledgerAccountId: 'la-ob', accountId: null, categoryId: null, system: 'opening_balances', amount: '-81230000', currency: 'NGN' },
        ],
        links: { reversalOf: null },
        version: 2,
      },
      'ws',
    );
    expect(rec).toMatchObject({ collection: 'events', id: 't1', version: 2 });
    expect((rec!.data as { lines: unknown[] }).lines).toEqual([
      { a: 'acc-bank', m: '81230000', c: 'NGN' },
      { a: 'ws:opening_balances', m: '-81230000', c: 'NGN' },
    ]);
  });

  it('keeps no copy of system categories, and keys occurrences by schedule and date', () => {
    expect(localFromServer('categories', 'c1', { id: 'c1', name: 'Fees', system: 'fees' }, 'ws')).toBeNull();
    const occ = localFromServer('occurrences', 'o1', { scheduleId: 's1', date: '2026-10-05', amount: '100', status: 'paid', matchedTransactionId: 't9' }, 'ws');
    expect(occ).toMatchObject({ id: 's1:2026-10-05', data: { status: 'paid', eventId: 't9' } });
  });

  it('translates debts and goals into the app words', () => {
    expect(localFromServer('debts', 'd1', { personName: 'Tunde', direction: 'they_owe_me', ledgerAccountId: 'la-r', status: 'written_off' }, 'ws')!.data).toMatchObject({
      name: 'Tunde',
      direction: 'owedToMe',
      status: 'settled',
    });
    expect(localFromServer('goals', 'g1', { name: 'Car', targetAmount: '500', accountId: 'a', status: 'in_progress' }, 'ws')!.data).toMatchObject({ status: 'active' });
  });

  it('maps server notifications into the inbox (kind, read, action, security)', () => {
    const rec = localFromServer(
      'notifications',
      'n1',
      {
        id: 'n1',
        kind: 'bill',
        title: 'Rent due',
        body: 'Tomorrow',
        amount: '50000',
        readAt: null,
        dismissedAt: null,
        security: false,
        actions: [{ key: 'mark_paid', label: 'Mark paid', target: { path: '/plan', params: { scheduleId: 's1', date: '2026-10-05' } } }],
        createdAt: '2026-10-28T11:00:00.000Z',
        version: 1,
      },
      'ws',
    );
    expect(rec).toMatchObject({
      collection: 'notifications',
      id: 'n1',
      version: 1,
      data: {
        title: 'Rent due',
        category: 'bills',
        read: false,
        action: 'mark_paid',
        recurringId: 's1',
        dueDate: '2026-10-05',
        amountMinor: '50000',
        security: false,
        dismissed: false,
      },
    });
    const sec = localFromServer(
      'notifications',
      'n2',
      {
        id: 'n2',
        kind: 'security',
        title: 'New sign-in',
        body: 'Was this you?',
        amount: null,
        readAt: '2026-10-28T12:00:00.000Z',
        dismissedAt: null,
        security: true,
        actions: [{ key: 'security_review', label: 'Review', target: { path: '/settings/security' } }],
        createdAt: '2026-10-28T11:00:00.000Z',
        version: 2,
      },
      'ws',
    );
    expect(sec!.data).toMatchObject({ category: 'security', read: true, action: 'security_review', security: true, hideAmount: true });
    const gone = localFromServer(
      'notifications',
      'n3',
      {
        id: 'n3',
        kind: 'sync',
        title: 'Sync issue',
        body: '',
        amount: null,
        readAt: null,
        dismissedAt: '2026-10-28T13:00:00.000Z',
        security: false,
        actions: [],
        createdAt: '2026-10-28T11:00:00.000Z',
        version: 1,
      },
      'ws',
    );
    expect(gone!.data).toMatchObject({ category: 'security', dismissed: true });
  });

  it('round-trips recurrence rules', () => {
    for (const rule of [
      { every: 'month' as const, on: 31, interval: 1 },
      { every: 'week' as const, on: 5, interval: 2 },
      { every: 'day' as const, on: 3 },
    ]) {
      expect(recurrenceFromServer(recurrenceToServer(rule), '2026-10-01')).toEqual(rule);
    }
    expect(scheduleBody('s1', { kind: 'bill', name: 'Rent', amountMinor: '100', accountId: 'a', rule: { every: 'month', on: 5 }, startDate: '2026-10-01', endAfterCount: 12 }).end).toEqual({
      kind: 'after',
      count: 12,
    });
  });
});
