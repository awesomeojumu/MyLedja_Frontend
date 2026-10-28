import cases from '../../../test/fixtures/ledger-cases.json';
import {
  buildAdjustment,
  buildExpense,
  buildIncome,
  buildOpeningBalance,
  buildRefund,
  buildTransfer,
  categoryActivity,
  Chart,
  envelopeBudget,
  Journal,
  ledgerBalance,
  monthIncome,
  monthSpent,
  netWorth,
  periodTotals,
  reconcileDelta,
  shownBalance,
  systemAccounts,
  type LedgerAccount,
  type LedgerKind,
  type LedgerResult,
  type Line,
  type NewEvent,
} from '..';

type Step = { key: string; type: string; date: string; input: Record<string, unknown>; operationId?: string; refused?: string; duplicateOf?: string };
type Case = (typeof cases.cases)[number] & { steps: Step[]; budget?: { months: string[]; assigned: Record<string, Record<string, string>> } };

const WS = 'ws';

function makeChart(): Chart {
  const own: LedgerAccount[] = cases.accounts.map((a) => ({ id: a.key, kind: a.kind as LedgerKind, name: a.key, currency: a.currency }));
  return new Chart([...own, ...systemAccounts(WS)]);
}

const id = (key: string) => (key.startsWith('system:') ? `${WS}:${key.slice(7)}` : key);
const big = (v: unknown) => BigInt(v as string);

function linesFor(chart: Chart, journal: Journal, keys: Map<string, string>, type: string, input: Record<string, unknown>): LedgerResult<Line[]> {
  switch (type) {
    case 'income':
      return buildIncome(chart, { accountId: id(input.account as string), categoryId: id(input.category as string), amount: big(input.amount) });
    case 'expense':
      return buildExpense(chart, {
        accountId: id(input.account as string),
        parts: (input.parts as { category: string; amount: string }[]).map((p) => ({ categoryId: id(p.category), amount: big(p.amount) })),
      });
    case 'transfer':
      return buildTransfer(chart, { fromId: id(input.from as string), toId: id(input.to as string), amount: big(input.amount) });
    case 'opening_balance':
      return buildOpeningBalance(chart, { accountId: id(input.account as string), amount: big(input.amount) });
    case 'reconcile': {
      const account = chart.get(id(input.account as string))!;
      const shown = shownBalance(account, ledgerBalance(account.id, journal.list()));
      return buildAdjustment(chart, { accountId: account.id, delta: reconcileDelta(account, big(input.statement), shown), against: 'adjustments' });
    }
    case 'refund':
      return buildRefund(chart, { accountId: id(input.account as string), original: journal.get(keys.get(input.of as string)!)!, amount: big(input.amount) });
    default:
      throw new Error(`Unknown step type ${type}`);
  }
}

const EVENT_TYPE: Record<string, NewEvent['type']> = { reconcile: 'balance_adjustment' };

function run(c: Case) {
  const chart = makeChart();
  let n = 0;
  const journal = new Journal(chart, [], () => `id-${++n}`);
  const keys = new Map<string, string>();
  for (const step of c.steps) {
    const operationId = step.operationId ?? `op-${step.key}`;
    if (step.type === 'correct') {
      const replacementType = step.input.type as string;
      const built = linesFor(chart, journal, keys, replacementType, step.input);
      if (!built.ok) throw new Error(built.error);
      const result = journal.correct(keys.get(step.input.of as string)!, `${operationId}-reversal`, {
        operationId,
        type: replacementType as NewEvent['type'],
        date: step.date,
        lines: built.value,
      });
      if (!result.ok) throw new Error(result.error);
      keys.set(step.key, result.value.event.id);
      continue;
    }
    const built = linesFor(chart, journal, keys, step.type, step.input);
    const posted = built.ok
      ? journal.post({
          operationId,
          type: EVENT_TYPE[step.type] ?? (step.type as NewEvent['type']),
          date: step.date,
          lines: built.value,
          refundOf: step.type === 'refund' ? keys.get(step.input.of as string) : undefined,
          splitTotal: step.input.split ? big(step.input.split) : undefined,
        })
      : built;
    if (step.refused) {
      expect(posted).toEqual({ ok: false, error: step.refused });
      continue;
    }
    if (!posted.ok) throw new Error(`${step.key}: ${posted.error}`);
    if (step.duplicateOf) {
      expect(posted.value.status).toBe('duplicate');
      expect(posted.value.event.id).toBe(keys.get(step.duplicateOf));
    }
    keys.set(step.key, posted.value.event.id);
  }
  return { chart, journal, keys };
}

describe('ledger-cases.json (TECH-SPEC 6.14)', () => {
  it.each((cases.cases as Case[]).map((c) => [c.case, c.title, c] as const))('case %s: %s', (_n, _title, c) => {
    const { chart, journal, keys } = run(c);
    const events = journal.list();
    const totals = periodTotals(events);
    const e = c.expect as Record<string, unknown>;

    for (const [key, value] of Object.entries((e.balances ?? {}) as Record<string, string>)) {
      const account = chart.get(id(key))!;
      expect([key, shownBalance(account, ledgerBalance(account.id, events))]).toEqual([key, BigInt(value)]);
    }
    for (const [month, value] of Object.entries((e.income ?? {}) as Record<string, string>)) {
      expect(monthIncome(chart, totals, month)).toBe(BigInt(value));
    }
    for (const [month, value] of Object.entries((e.spent ?? {}) as Record<string, string>)) {
      expect(monthSpent(chart, totals, month)).toBe(BigInt(value));
    }
    for (const [month, byCategory] of Object.entries((e.spentIn ?? {}) as Record<string, Record<string, string>>)) {
      for (const [key, value] of Object.entries(byCategory)) expect(categoryActivity(totals, month, id(key))).toBe(BigInt(value));
    }
    if (e.netWorth !== undefined) expect(netWorth(chart, events, '2026-12-31').total).toBe(BigInt(e.netWorth as string));
    if (e.events !== undefined) expect(events).toHaveLength(e.events as number);
    for (const key of (e.reversed ?? []) as string[]) expect(journal.get(keys.get(key)!)!.status).toBe('reversed');

    if (c.budget) {
      const budget = c.budget;
      const categories = cases.accounts.filter((a) => a.kind === 'expense').map((a) => ({ ledgerAccountId: a.key }));
      const months = envelopeBudget({
        months: budget.months,
        categories,
        assigned: (cat, m) => BigInt(budget.assigned[m]?.[cat] ?? '0'),
        activity: (cat, m) => categoryActivity(totals, m, cat),
        budgetableIncome: (m) => monthIncome(chart, totals, m, true),
      });
      const expected = e.budget as Record<string, { leftToPlan: string; rows: Record<string, Record<string, string>> }>;
      for (const month of months) {
        const want = expected[month.month];
        if (!want) continue;
        expect(month.leftToPlan).toBe(BigInt(want.leftToPlan));
        for (const [cat, fields] of Object.entries(want.rows)) {
          const row = month.rows.get(cat)!;
          for (const [field, value] of Object.entries(fields)) expect(row[field as keyof typeof row]).toBe(BigInt(value));
        }
      }
    }
  });
});
