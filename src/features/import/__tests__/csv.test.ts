import type { TxEvent } from '@/data/workspace/repository';

import { guessMapping, isDuplicate, parseAmount, parseCsv, parseDate, readRows, similar } from '../csv';

describe('parseCsv', () => {
  it('handles quotes, commas, doubled quotes, CRLF and a byte order mark', () => {
    expect(parseCsv('\uFEFFDate,Narration,Amount\r\n01/10/2026,"Shoprite, Lekki",-18450\r\n02/10/2026,"He said ""hi""",500\r\n')).toEqual([
      ['Date', 'Narration', 'Amount'],
      ['01/10/2026', 'Shoprite, Lekki', '-18450'],
      ['02/10/2026', 'He said "hi"', '500'],
    ]);
  });
  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n,\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('parseAmount', () => {
  it.each([
    ['₦1,234.50', 123450n],
    ['-18,450', -1845000n],
    ['(500.00)', -50000n],
    ['250.5 DR', -25050n],
    ['250.5CR', 25050n],
    ['+3', 300n],
    ['NGN 10', 1000n],
  ])('%s → %s kobo', (input, expected) => expect(parseAmount(input)).toBe(expected));
  it.each(['', 'abc', '1.234', '1e5'])('refuses %p', (input) => expect(parseAmount(input)).toBeNull());
});

describe('parseDate', () => {
  it('reads each format and refuses impossible days', () => {
    expect(parseDate('28/10/2026', 'DD/MM/YYYY')).toBe('2026-10-28');
    expect(parseDate('10/28/2026', 'MM/DD/YYYY')).toBe('2026-10-28');
    expect(parseDate('2026-10-28', 'YYYY-MM-DD')).toBe('2026-10-28');
    expect(parseDate('28-10-26', 'DD/MM/YYYY')).toBe('2026-10-28');
    expect(parseDate('31/02/2026', 'DD/MM/YYYY')).toBeNull();
    expect(parseDate('soon', 'DD/MM/YYYY')).toBeNull();
  });
});

describe('readRows', () => {
  it('reports broken rows instead of posting them (B1.12)', () => {
    const table = parseCsv(
      'Date,Description,Debit,Credit\n01/10/2026,Shoprite,18450,\n02/10/2026,Acme salary,,640000\nnot a date,Bolt,8500,\n03/10/2026,Nothing,,',
    );
    const mapping = guessMapping(table[0]);
    expect(mapping).toMatchObject({ date: 0, amount: null, moneyIn: 3, moneyOut: 2, description: 1 });
    const { rows, broken } = readRows(table, mapping);
    expect(rows.map((r) => [r.date, r.amount])).toEqual([
      ['2026-10-01', -1845000n],
      ['2026-10-02', 64000000n],
    ]);
    expect(broken).toEqual([
      { line: 4, reason: 'date' },
      { line: 5, reason: 'amount' },
    ]);
  });
  it('uses a saved mapping as is (P09-05)', () => {
    const saved = {
      date: 2,
      amount: 0,
      moneyIn: null,
      moneyOut: null,
      description: 1,
      payee: null,
      notes: null,
      dateFormat: 'YYYY-MM-DD' as const,
      hasHeader: false,
    };
    expect(guessMapping(['x'], saved)).toBe(saved);
  });
});

describe('duplicates', () => {
  const event = (over: Partial<TxEvent>): TxEvent => ({
    id: 'e1',
    operationId: 'e1',
    type: 'expense',
    date: '2026-10-01',
    status: 'posted',
    lines: [
      { ledgerAccountId: 'acc', amountMinor: -1845000n, currency: 'NGN' },
      { ledgerAccountId: 'cat', amountMinor: 1845000n, currency: 'NGN' },
    ],
    payeeId: 'p1',
    ...over,
  });
  const payees = new Map([['p1', 'Shoprite']]);
  const row = { line: 2, date: '2026-10-03', amount: -1845000n, description: 'POS SHOPRITE LEKKI', payee: 'POS SHOPRITE LEKKI', notes: '' };

  it('same account, amount, within 3 days and a similar description is a duplicate', () => {
    expect(isDuplicate(row, 'acc', [event({})], payees)).toBe(true);
  });
  it('a different amount, a 4 day gap, another account or a reversed event is not', () => {
    expect(isDuplicate({ ...row, amount: -1845100n }, 'acc', [event({})], payees)).toBe(false);
    expect(isDuplicate({ ...row, date: '2026-10-05' }, 'acc', [event({})], payees)).toBe(false);
    expect(isDuplicate(row, 'other', [event({})], payees)).toBe(false);
    expect(isDuplicate(row, 'acc', [event({ status: 'reversed' })], payees)).toBe(false);
  });
  it('similar descriptions', () => {
    expect(similar('Bolt ride', 'BOLT RIDE LAGOS')).toBe(true);
    expect(similar('Bolt', 'Shoprite')).toBe(false);
    expect(similar('', 'x')).toBe(false);
  });
});
