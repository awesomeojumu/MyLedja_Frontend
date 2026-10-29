import {
  barState,
  buildExpense,
  buildIncome,
  buildOpeningBalance,
  buildReversal,
  buildTransfer,
  Chart,
  checkEvent,
  Journal,
  ledgerBalance,
  monthIncome,
  monthSpent,
  netWorth,
  nextMonth,
  periodTotals,
  systemAccounts,
  trackingBudget,
  SYSTEM_ACCOUNTS,
  type LedgerAccount,
  type MoneyEvent,
} from '..';

const accounts: LedgerAccount[] = [
  { id: 'bank', kind: 'asset', name: 'Bank', currency: 'NGN' },
  { id: 'wallet', kind: 'asset', name: 'Wallet', currency: 'NGN' },
  { id: 'card', kind: 'liability', name: 'Card', currency: 'NGN' },
  { id: 'usd', kind: 'asset', name: 'Dollars', currency: 'USD' },
  { id: 'salary', kind: 'income', name: 'Salary', currency: 'NGN' },
  { id: 'gift', kind: 'income', name: 'Gift', currency: 'NGN', countInBudget: false },
  { id: 'food', kind: 'expense', name: 'Food', currency: 'NGN' },
  { id: 'rent', kind: 'expense', name: 'Rent', currency: 'NGN' },
  ...systemAccounts('ws'),
];
const chart = new Chart(accounts);

describe('seeding', () => {
  it('gives the same ids every time and covers every system account', () => {
    expect(systemAccounts('ws')).toEqual(systemAccounts('ws'));
    expect(systemAccounts('ws').map((a) => a.system)).toEqual(Object.keys(SYSTEM_ACCOUNTS));
  });
});

describe('event builders give exact lines', () => {
  it('E1 income', () => {
    expect(buildIncome(chart, { accountId: 'bank', categoryId: 'salary', amount: 500n })).toEqual({
      ok: true,
      value: [
        { ledgerAccountId: 'bank', amountMinor: 500n, currency: 'NGN' },
        { ledgerAccountId: 'salary', amountMinor: -500n, currency: 'NGN' },
      ],
    });
  });

  it('E2 refuses an income category as the expense', () => {
    expect(buildExpense(chart, { accountId: 'bank', parts: [{ categoryId: 'salary', amount: 1n }] })).toEqual({ ok: false, error: 'wrong_account_kind' });
  });

  it('E6 refuses the same account twice; E7 needs the arrived amount', () => {
    expect(buildTransfer(chart, { fromId: 'bank', toId: 'bank', amount: 1n })).toEqual({ ok: false, error: 'transfer_accounts' });
    expect(buildTransfer(chart, { fromId: 'bank', toId: 'usd', amount: 1n })).toEqual({ ok: false, error: 'currency_mismatch' });
  });

  it('E7 transfer between currencies balances each side through fx-clearing', () => {
    const r = buildTransfer(chart, { fromId: 'bank', toId: 'usd', amount: 18600000n, toAmount: 12000n });
    expect(r).toEqual({
      ok: true,
      value: [
        { ledgerAccountId: 'ws:fx_clearing', amountMinor: 18600000n, currency: 'NGN' },
        { ledgerAccountId: 'bank', amountMinor: -18600000n, currency: 'NGN' },
        { ledgerAccountId: 'usd', amountMinor: 12000n, currency: 'USD' },
        { ledgerAccountId: 'ws:fx_clearing', amountMinor: -12000n, currency: 'USD' },
      ],
    });
    if (!r.ok) throw new Error();
    expect(
      checkEvent(
        chart,
        { id: 'fx', operationId: 'fx', type: 'transfer', date: '2026-10-01', status: 'posted', lines: r.value },
        new Map(),
      ).ok,
    ).toBe(true);
  });

  it('E8 on a liability credits the account', () => {
    const r = buildOpeningBalance(chart, { accountId: 'card', amount: 700n });
    expect(r.ok && r.value[0]).toEqual({ ledgerAccountId: 'card', amountMinor: -700n, currency: 'NGN' });
  });

  it('refuses amounts of zero or less', () => {
    expect(buildIncome(chart, { accountId: 'bank', categoryId: 'salary', amount: 0n }).ok).toBe(false);
  });
});

describe('integrity checks (TECH-SPEC 6.11)', () => {
  const base: MoneyEvent = { id: 'x', operationId: 'o', type: 'expense', date: '2026-10-01', status: 'posted', lines: [] };

  it('refuses lines that do not add up to zero', () => {
    const lines = [
      { ledgerAccountId: 'food', amountMinor: 10n, currency: 'NGN' },
      { ledgerAccountId: 'bank', amountMinor: -9n, currency: 'NGN' },
    ];
    expect(checkEvent(chart, { ...base, lines }, new Map())).toEqual({ ok: false, error: 'unbalanced' });
  });

  it('refuses a line whose currency is not its account’s', () => {
    const lines = [
      { ledgerAccountId: 'food', amountMinor: 10n, currency: 'USD' },
      { ledgerAccountId: 'bank', amountMinor: -10n, currency: 'USD' },
    ];
    expect(checkEvent(chart, { ...base, lines }, new Map())).toEqual({ ok: false, error: 'currency_mismatch' });
  });

  it('refuses a split whose parts miss the total', () => {
    const r = buildExpense(chart, { accountId: 'bank', parts: [{ categoryId: 'food', amount: 3n }, { categoryId: 'rent', amount: 5n }] });
    expect(r.ok && checkEvent(chart, { ...base, lines: r.value, splitTotal: 9n }, new Map())).toEqual({ ok: false, error: 'split_mismatch' });
  });

  it('refuses reversing something twice, and correcting it after', () => {
    const journal = new Journal(chart);
    const r = buildExpense(chart, { accountId: 'bank', parts: [{ categoryId: 'food', amount: 3n }] });
    if (!r.ok) throw new Error();
    const posted = journal.post({ operationId: 'a', type: 'expense', date: '2026-10-01', lines: r.value });
    if (!posted.ok) throw new Error();
    expect(journal.reverse(posted.value.event.id, 'b', '2026-10-02').ok).toBe(true);
    expect(journal.reverse(posted.value.event.id, 'c', '2026-10-02')).toEqual({ ok: false, error: 'already_reversed' });
    expect(journal.correct(posted.value.event.id, 'd', { operationId: 'e', type: 'expense', date: '2026-10-02', lines: r.value })).toEqual({
      ok: false,
      error: 'already_reversed',
    });
  });
});

describe('read formulas', () => {
  it('counts only budgetable income on the Dashboard', () => {
    const journal = new Journal(chart);
    for (const [cat, amount] of [['salary', 100n], ['gift', 40n]] as const) {
      const r = buildIncome(chart, { accountId: 'bank', categoryId: cat, amount });
      if (r.ok) journal.post({ operationId: cat, type: 'income', date: '2026-10-02', lines: r.value });
    }
    const totals = periodTotals(journal.list());
    expect(monthIncome(chart, totals, '2026-10')).toBe(140n);
    expect(monthIncome(chart, totals, '2026-10', true)).toBe(100n);
  });

  it('ignores pending events and events after the date', () => {
    const lines = [
      { ledgerAccountId: 'bank', amountMinor: 5n, currency: 'NGN' },
      { ledgerAccountId: 'salary', amountMinor: -5n, currency: 'NGN' },
    ];
    const events: MoneyEvent[] = [
      { id: '1', operationId: '1', type: 'income', date: '2026-10-01', status: 'pending', lines },
      { id: '2', operationId: '2', type: 'income', date: '2026-10-09', status: 'posted', lines },
    ];
    expect(ledgerBalance('bank', events, '2026-10-05')).toBe(0n);
    expect(ledgerBalance('bank', events)).toBe(5n);
  });

  it('converts other currencies at the rate given (case 25), and says when one is missing', () => {
    const lines = [
      { ledgerAccountId: 'usd', amountMinor: 12000n, currency: 'USD' },
      { ledgerAccountId: 'ws:opening_balances', amountMinor: -12000n, currency: 'USD' },
    ];
    const usdChart = new Chart([...accounts.filter((a) => !a.system), ...systemAccounts('ws').map((a) => (a.system === 'opening_balances' ? { ...a, currency: 'USD' } : a))]);
    const events: MoneyEvent[] = [{ id: '1', operationId: '1', type: 'opening_balance', date: '2026-10-01', status: 'posted', lines }];
    expect(netWorth(usdChart, events, '2026-10-01', { USD: { numerator: 1550n, denominator: 1n } })).toEqual({ total: 18600000n, partial: [] });
    expect(netWorth(usdChart, events, '2026-10-01')).toEqual({ total: 0n, partial: ['USD'] });
  });

  it('marks bars within, near and over plan', () => {
    expect(barState(79n, 100n)).toBe('within');
    expect(barState(80n, 100n)).toBe('near');
    expect(barState(100n, 100n)).toBe('over');
    expect(barState(1n, 0n)).toBe('over');
  });

  it('carries over in Spending limits only where the switch is on', () => {
    const months = trackingBudget({
      months: ['2026-10', '2026-11', '2026-12'],
      categories: [{ ledgerAccountId: 'food', carryOver: true }, { ledgerAccountId: 'rent' }],
      assigned: () => 100n,
      activity: () => 60n,
      budgetableIncome: () => 0n,
    });
    expect(months.map((m) => m.rows.get('food')!.available)).toEqual([40n, 80n, 120n]);
    expect(months.map((m) => m.rows.get('rent')!.available)).toEqual([40n, 40n, 40n]);
  });

  it('rolls months over the year end', () => {
    expect(nextMonth('2026-12')).toBe('2027-01');
    expect(nextMonth('2026-09')).toBe('2026-10');
  });
});

/** A small seeded generator, so a failing run can be repeated. */
function random(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

describe('properties', () => {
  it.each([1, 2, 3, 4, 5])('every journal adds up to zero and reversals undo exactly (seed %s)', (seed) => {
    const next = random(seed);
    const journal = new Journal(chart);
    const money = ['bank', 'wallet', 'card'];
    for (let i = 0; i < 200; i++) {
      const amount = BigInt(next(5_000_000) + 1);
      const date = `2026-${String(next(12) + 1).padStart(2, '0')}-${String(next(28) + 1).padStart(2, '0')}`;
      const account = money[next(3)]!;
      const roll = next(4);
      const built =
        roll === 0
          ? buildIncome(chart, { accountId: account, categoryId: 'salary', amount })
          : roll === 1
            ? buildExpense(chart, { accountId: account, parts: [{ categoryId: 'food', amount }, { categoryId: 'rent', amount: amount + 1n }] })
            : roll === 2
              ? buildTransfer(chart, { fromId: account, toId: money[(money.indexOf(account) + 1) % 3]!, amount })
              : null;
      if (built?.ok) journal.post({ operationId: `op${i}`, type: roll === 0 ? 'income' : roll === 1 ? 'expense' : 'transfer', date, lines: built.value });
      if (roll === 3) {
        const target = journal.list().find((e) => e.status === 'posted' && e.type !== 'reversal');
        if (target) journal.reverse(target.id, `rev${i}`, date);
      }
    }
    const events = journal.list();
    const all = events.flatMap((e) => e.lines).reduce((s, l) => s + l.amountMinor, 0n);
    expect(all).toBe(0n);

    const live = events.filter((e) => e.status === 'posted' && e.type !== 'reversal');
    for (const a of accounts) {
      const fromLive = live.flatMap((e) => e.lines).filter((l) => l.ledgerAccountId === a.id).reduce((s, l) => s + l.amountMinor, 0n);
      expect(ledgerBalance(a.id, events)).toBe(fromLive);
    }

    const totals = periodTotals(events);
    for (const [month, byAccount] of totals) {
      expect([month, [...byAccount.values()].reduce((s, v) => s + v, 0n)]).toEqual([month, 0n]);
      const spentByHand = [...byAccount].filter(([id]) => chart.get(id)?.kind === 'expense').reduce((s, [, v]) => s + v, 0n);
      expect(monthSpent(chart, totals, month)).toBe(spentByHand);
    }
  });

  it('a reversal is the exact negation of its original', () => {
    const r = buildExpense(chart, { accountId: 'card', parts: [{ categoryId: 'food', amount: 77n }] });
    if (!r.ok) throw new Error();
    const event: MoneyEvent = { id: 'a', operationId: 'a', type: 'expense', date: '2026-10-01', status: 'posted', lines: r.value };
    expect(buildReversal(event).map((l) => l.amountMinor)).toEqual(r.value.map((l) => -l.amountMinor));
  });
});
