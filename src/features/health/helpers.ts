import { DEFAULT_HEALTH_SETTINGS, type HealthSettings } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { budgetForMonth } from '@/features/budget/helpers';
import { converterFor, holdingRows } from '@/features/investments/helpers';
import { factsOf, lookupOf, monthBounds, shiftMonth } from '@/features/reports/runner';
import { health, type Health, type HealthInput, type PillarKey } from '@/ledger/health';
import type { Fact } from '@/ledger/reports';

/** The same rules as the server's (TECH-SPEC 6.10 and 6.13): change both together. */
const LIQUID_TYPES = new Set(['bank', 'cash', 'wallet', 'savings']);
const INVESTMENT_TYPES = new Set(['investment', 'pension', 'fixed_deposit']);
const ESSENTIAL_GROUPS = new Set(['group.home', 'group.food', 'group.gettingAround', 'group.health', 'group.education', 'home', 'food', 'getting around', 'health', 'education']);

const DAY = 86_400_000;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const minDate = (a: string, b: string) => (a < b ? a : b);

export type HealthPage = Health & {
  month: string;
  /** Points up or down from the month before; null when either has no score. */
  change: number | null;
  reason: { strongest: PillarKey | null; weakest: PillarKey | null };
  /** Set when a counted account hasn't moved for 30 days (P23-04). */
  basedOnDataUpTo: string | null;
  history: { month: string; score: number | null }[];
  /** Last month's pillars, for "this vs last month". */
  previous: Health;
  input: HealthInput;
  settings: HealthSettings;
};

export function healthSettingsOf(snapshot: Snapshot): HealthSettings {
  return snapshot.settings?.healthSettings ?? DEFAULT_HEALTH_SETTINGS;
}

/** Cash today in the accounts that count, and when each last moved. Borrowed money is taken out later. */
function liquid(snapshot: Snapshot, facts: Fact[], date: string, settings: HealthSettings) {
  const counted = snapshot.accounts.filter((a) => {
    if (a.archived) return false;
    if (settings.cashAccountIds?.length) return settings.cashAccountIds.includes(a.id);
    return LIQUID_TYPES.has(a.type) || (settings.countInvestments && INVESTMENT_TYPES.has(a.type));
  });
  const ids = new Set(counted.map((a) => a.id));
  const raw = new Map<string, bigint>();
  const lastSeen = new Map<string, string>();
  for (const f of facts) {
    if (f.date > date || !ids.has(f.ledgerAccountId)) continue;
    raw.set(f.ledgerAccountId, (raw.get(f.ledgerAccountId) ?? 0n) + f.amount);
    if ((lastSeen.get(f.ledgerAccountId) ?? '') < f.date) lastSeen.set(f.ledgerAccountId, f.date);
  }
  const convert = converterFor(snapshot);
  let cash = 0n;
  for (const a of counted) cash += convert(raw.get(a.id) ?? 0n, a.currency, date) ?? 0n;
  if (settings.countInvestments) {
    for (const r of holdingRows(snapshot, date)) cash += convert(r.position.value, r.holding.currency, date) ?? 0n;
  }
  return { cash, counted, lastSeen };
}

/** The Health page for a month on the device's data (DESIGN.md page 23). */
export function healthPage(snapshot: Snapshot, month: string, today: string, opts: { history?: boolean } = {}): HealthPage {
  const settings = healthSettingsOf(snapshot);
  const look = lookupOf(snapshot);
  const facts = factsOf(snapshot).filter((f) => f.date <= today);
  const firstDate = facts.reduce<string | null>((a, f) => (a === null || f.date < a ? f.date : a), null);
  const categories = new Map(snapshot.categories.map((c) => [c.id, c]));
  const essential = (ledgerId: string) => {
    const c = categories.get(look.categoryOf(ledgerId) ?? '');
    return !!c && (!!c.essential || c.budgetType === 'fixed' || ESSENTIAL_GROUPS.has(c.group) || ESSENTIAL_GROUPS.has(c.group.toLowerCase()));
  };
  const eventDates = new Map(snapshot.events.map((e) => [e.id, e.date]));
  const kinds = new Map(snapshot.recurring.map((r) => [r.id, r.kind]));

  const inputFor = (m: string): { input: HealthInput; asOf: string } => {
    const current = m === today.slice(0, 7);
    const asOf = current ? today : minDate(monthBounds(m).to, today);
    const last = current ? shiftMonth(m, -1) : m;
    const months = [shiftMonth(last, -2), shiftMonth(last, -1), last];
    const window = { from: monthBounds(months[0]!).from, to: monthBounds(last).to };
    const inWindow = facts.filter((f) => f.date >= window.from && f.date <= window.to);
    const perMonth = months.map((mm) => {
      const { from, to } = monthBounds(mm);
      let income = 0n;
      let spending = 0n;
      let essentialSpent = 0n;
      let hasData = false;
      for (const f of inWindow) {
        if (f.date < from || f.date > to) continue;
        const kind = look.kindOf(f.ledgerAccountId);
        if (kind === 'income') income -= f.amount;
        if (kind === 'expense') {
          spending += f.amount;
          if (essential(f.ledgerAccountId)) essentialSpent += f.amount;
        }
        if (kind === 'income' || kind === 'expense') hasData = true;
      }
      return { month: mm, income, spending, essential: essentialSpent, hasData };
    });
    const debtPayments = months.map((mm) => {
      const { from, to } = monthBounds(mm);
      return inWindow
        .filter((f) => f.date >= from && f.date <= to)
        .filter((f) => (f.type === 'loan_repayment' || f.reversedType === 'loan_repayment') && look.isCash(f.ledgerAccountId))
        .reduce((s, f) => s - f.amount, 0n);
    });
    // Borrowed in the three months and still owed: never counted as cash (P23-07).
    const borrowed = facts
      .filter((f) => f.date > addDays(asOf, -92) && f.date <= asOf)
      .filter((f) => (f.type === 'loan_proceeds' || f.reversedType === 'loan_proceeds') && look.kindOf(f.ledgerAccountId) === 'liability')
      .reduce((s, f) => s - f.amount, 0n);
    const owed = facts.filter((f) => f.date <= asOf && look.kindOf(f.ledgerAccountId) === 'liability').reduce((s, f) => s - f.amount, 0n);
    const { cash } = liquid(snapshot, facts, asOf, settings);
    let due = 0;
    let onTime = 0;
    for (const o of snapshot.occurrences) {
      const kind = kinds.get(o.recurringId);
      if (kind !== 'bill' && kind !== 'subscription') continue;
      if (o.dueDate < window.from || o.dueDate > minDate(window.to, asOf)) continue;
      due += 1;
      const paidOn = o.status === 'paid' && o.eventId ? eventDates.get(o.eventId) : null;
      if (paidOn && paidOn <= o.dueDate) onTime += 1;
    }
    const budget = budgetForMonth(snapshot, last);
    // A category with no plan has nothing to keep to.
    const planned = [...budget.rows.values()].filter((r) => r.carried + r.assigned > 0n);
    return {
      asOf,
      input: {
        months: perMonth,
        liquidCash: cash,
        recentBorrowing: borrowed < owed ? (borrowed > 0n ? borrowed : 0n) : owed > 0n ? owed : 0n,
        debtPayments,
        bills: { due, onTime },
        budget: { planned: planned.length, within: planned.filter((r) => r.available >= 0n).length, overspent: planned.filter((r) => r.available < 0n).length },
        historyDays: firstDate ? Math.max(0, Math.round((Date.parse(asOf) - Date.parse(firstDate)) / DAY)) : 0,
        targetMonths: settings.targetMonths,
      },
    };
  };

  const { input, asOf } = inputFor(month);
  const h = health(input);
  // The Dashboard card needs only last month's score, for the change.
  const back = opts.history === false ? 1 : 11;
  const earlier = new Map(Array.from({ length: back }, (_, i) => shiftMonth(month, i - back)).map((m) => [m, health(inputFor(m).input)]));
  const history = [...earlier].map(([m, x]) => ({ month: m, score: x.score })).concat({ month, score: h.score });
  const before = history.at(-2)?.score ?? null;
  const scored = h.pillars.filter((p) => p.score !== null);
  const strongest = scored.reduce<(typeof scored)[number] | null>((a, p) => (!a || p.score! > a.score! ? p : a), null);
  const weakest = scored.reduce<(typeof scored)[number] | null>((a, p) => (!a || p.score! < a.score! ? p : a), null);
  const { lastSeen, counted } = liquid(snapshot, facts, asOf, settings);
  const staleBefore = addDays(asOf, -30);
  const stale = counted
    .map((a) => lastSeen.get(a.id) ?? null)
    .filter((d): d is string => d !== null && d < staleBefore)
    .sort();
  return {
    ...h,
    month,
    change: h.score !== null && before !== null ? h.score - before : null,
    reason: { strongest: strongest?.key ?? null, weakest: weakest?.key ?? null },
    basedOnDataUpTo: stale[0] ?? null,
    history,
    previous: earlier.get(shiftMonth(month, -1))!,
    input,
    settings,
  };
}
