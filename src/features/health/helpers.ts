import { DEFAULT_HEALTH_SETTINGS, normalizeHealthSettings, type HealthSettings } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { budgetForMonth } from '@/features/budget/helpers';
import { holdingFigures } from '@/features/investments/helpers';
import { t, type TextKey } from '@/i18n';
import { health, type Advice, type Health, type HealthInput, type Pillar, type PillarKey } from '@/ledger/health';
import { nextMonth, prevMonth, type EventType, type MoneyEvent } from '@/ledger';
import { roundHalfAwayFromZero } from '@/money';

/** The same rules as the server's (TECH-SPEC 6.10 and 6.13): change both together. */
const LIQUID_TYPES = new Set(['bank', 'cash', 'wallet', 'savings']);
const INVESTMENT_TYPES = new Set(['investment']);
const ESSENTIAL_GROUPS = new Set([
  'group.home',
  'group.food',
  'group.gettingAround',
  'group.health',
  'group.education',
  'home',
  'food',
  'getting around',
  'health',
  'education',
]);

const DAY = 86_400_000;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const minDate = (a: string, b: string) => (a < b ? a : b);

export function shiftMonth(month: string, delta: number): string {
  let m = month;
  if (delta >= 0) for (let i = 0; i < delta; i += 1) m = nextMonth(m);
  else for (let i = 0; i < -delta; i += 1) m = prevMonth(m);
  return m;
}

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

type Fact = { date: string; ledgerAccountId: string; amount: bigint; type: EventType; eventId: string };

function factsOf(snapshot: Snapshot): Fact[] {
  const out: Fact[] = [];
  for (const e of snapshot.events) {
    if (e.status === 'pending') continue;
    for (const l of e.lines) {
      out.push({ date: e.date, ledgerAccountId: l.ledgerAccountId, amount: l.amountMinor, type: e.type, eventId: e.id });
    }
  }
  return out;
}

function lookupOf(snapshot: Snapshot) {
  const byId = new Map(snapshot.accounts.map((a) => [a.id, a]));
  return {
    kindOf: (id: string) => snapshot.chart.get(id)?.kind,
    isCash: (id: string) => {
      const a = byId.get(id);
      return !!a && LIQUID_TYPES.has(a.type);
    },
  };
}

export type HealthPage = Health & {
  month: string;
  change: number | null;
  reason: { strongest: PillarKey | null; weakest: PillarKey | null };
  basedOnDataUpTo: string | null;
  history: { month: string; score: number | null }[];
  previous: Health;
  input: HealthInput;
  settings: HealthSettings;
};

export function healthSettingsOf(snapshot: Snapshot): HealthSettings {
  return normalizeHealthSettings(snapshot.settings?.health) ?? { ...DEFAULT_HEALTH_SETTINGS };
}

/** PU-45: shared text must not include naira when amounts are hidden. */
export function shareHasNaira(text: string): boolean {
  return /₦|\bNGN\b/.test(text);
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
  let cash = 0n;
  for (const a of counted) cash += raw.get(a.id) ?? 0n;
  if (settings.countInvestments) {
    for (const h of snapshot.holdings) {
      cash += holdingFigures(snapshot, h, date).value;
    }
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
    const c = categories.get(ledgerId);
    return !!c && (!!c.essential || c.budgetType === 'fixed' || ESSENTIAL_GROUPS.has(c.group) || ESSENTIAL_GROUPS.has(c.group.toLowerCase()));
  };
  const eventDates = new Map(snapshot.events.map((e: MoneyEvent) => [e.id, e.date]));
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
        .filter((f) => f.type === 'loan_repayment' && look.isCash(f.ledgerAccountId))
        .reduce((s, f) => s - f.amount, 0n);
    });
    // Borrowed in the three months and still owed: never counted as cash (P23-07).
    const borrowed = facts
      .filter((f) => f.date > addDays(asOf, -92) && f.date <= asOf)
      .filter((f) => f.type === 'loan_proceeds' && look.kindOf(f.ledgerAccountId) === 'liability')
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
    const planned = [...budget.rows.values()].filter((r) => r.carried + r.assigned > 0n);
    return {
      asOf,
      input: {
        months: perMonth,
        liquidCash: cash,
        recentBorrowing: borrowed < owed ? (borrowed > 0n ? borrowed : 0n) : owed > 0n ? owed : 0n,
        debtPayments,
        bills: { due, onTime },
        budget: {
          planned: planned.length,
          within: planned.filter((r) => r.available >= 0n).length,
          overspent: planned.filter((r) => r.available < 0n).length,
        },
        historyDays: firstDate ? Math.max(0, Math.round((Date.parse(asOf) - Date.parse(firstDate)) / DAY)) : 0,
        targetMonths: settings.targetMonths,
      },
    };
  };

  const { input, asOf } = inputFor(month);
  const h = health(input);
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

/** "26%" from basis points. */
const pctText = (bp: bigint) => `${roundHalfAwayFromZero(bp, 100n)}%`;
/** "3.2" from hundredths of a month. */
const monthsLabel = (h: bigint) => `${h / 100n}.${(h % 100n) / 10n}`;

/** What a pillar's tile says (DESIGN.md page 23). */
export function pillarValue(p: Pillar): string {
  if (p.value === null && p.score === null) return t('health.notEnough');
  switch (p.key) {
    case 'saving':
      return p.value === null ? t('health.notEnough') : t('health.value.saving', { pct: pctText(p.value) });
    case 'runway':
      return p.value === null
        ? t('health.value.runwayNoSpending')
        : t('health.value.runway', { months: monthsLabel(p.value), target: String(p.used.target) });
    case 'debt_load':
      return p.value === null ? t('health.value.debtNoIncome') : t('health.value.debt', { pct: pctText(p.value) });
    case 'bills':
      return t('health.value.bills', { pct: pctText(p.value ?? 0n) });
    case 'budget':
      return t('health.value.budget', { within: String(p.used.within), planned: String(p.used.planned) });
  }
}

/** One plain sentence on why (P23-01): what's going well and what would lift the score. */
export function reasonText(page: HealthPage): string {
  const parts: string[] = [];
  if (page.reason.strongest) parts.push(t(`health.good.${page.reason.strongest}` as TextKey));
  if (page.reason.weakest && page.band !== 'strong') parts.push(t(`health.next.${page.reason.weakest}` as TextKey));
  return parts.join(' ');
}

export function adviceText(a: Advice, show: (v: bigint) => string): string {
  switch (a.pillar) {
    case 'runway':
      return t('health.advice.runway', { amount: show(a.monthly) });
    case 'bills':
      return t('health.advice.bills', { count: String(a.late) });
    case 'budget':
      return t('health.advice.budget', { count: String(a.overspent) });
    default:
      return t(`health.advice.${a.pillar}` as TextKey);
  }
}
