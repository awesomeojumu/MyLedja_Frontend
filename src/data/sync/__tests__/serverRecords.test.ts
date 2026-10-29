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

  it('maps reconcile locks and finished reconciliations from the server', () => {
    const locked = localFromServer(
      'transactions',
      't2',
      {
        id: 't2',
        type: 'expense',
        date: '2026-10-15',
        lines: [],
        links: {},
        reconciled: true,
        reconciliationId: 'rec-1',
        clearedAccountIds: ['acc-bank'],
        version: 1,
      },
      'ws',
    );
    expect(locked!.data).toMatchObject({ reconciledBy: 'rec-1', cleared: true });
    const history = localFromServer(
      'reconciliations',
      'rec-1',
      {
        id: 'rec-1',
        accountId: 'acc-bank',
        status: 'finished',
        statementDate: '2026-10-31',
        statementBalance: '81230000',
        cleared: '81230000',
        finishedAt: '2026-10-31T12:00:00.000Z',
        finishedBy: 'user-1',
        version: 2,
      },
      'ws',
    );
    expect(history).toMatchObject({
      collection: 'reconciles',
      id: 'rec-1',
      data: { accountId: 'acc-bank', finishedBy: 'user-1', statementBalance: '81230000' },
    });
    expect(localFromServer('reconciliations', 'rec-2', { id: 'rec-2', status: 'in_progress', accountId: 'a', statementDate: '2026-10-01', statementBalance: '0' }, 'ws')).toBeNull();
  });

  it('keeps no copy of system categories, and keys occurrences by schedule and date', () => {
    expect(localFromServer('categories', 'c1', { id: 'c1', name: 'Fees', system: 'fees' }, 'ws')).toBeNull();
    const occ = localFromServer('occurrences', 'o1', { scheduleId: 's1', date: '2026-10-05', amount: '100', status: 'paid', matchedTransactionId: 't9' }, 'ws');
    expect(occ).toMatchObject({ id: 's1:2026-10-05', data: { status: 'paid', eventId: 't9' } });
  });

  it('translates debts and goals into the app words', () => {
    expect(
      localFromServer(
        'debts',
        'd1',
        {
          personName: 'Tunde',
          direction: 'they_owe_me',
          ledgerAccountId: 'la-r',
          status: 'written_off',
          interest: { kind: 'percent', rateBasisPoints: 200 },
          instalments: { count: 3, amount: '100', firstDate: '2026-11-01', everyMonths: 1, everyWeeks: 1 },
        },
        'ws',
      )!.data,
    ).toMatchObject({
      name: 'Tunde',
      direction: 'owedToMe',
      status: 'written_off',
      interest: { kind: 'percent_month', percent: 2 },
      scheduleEvery: 'week',
      scheduleInstallmentCount: 3,
      scheduleFirstDue: '2026-11-01',
    });
    expect(localFromServer('goals', 'g1', { name: 'Car', targetAmount: '500', accountId: 'a', status: 'in_progress' }, 'ws')!.data).toMatchObject({ status: 'active' });
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
