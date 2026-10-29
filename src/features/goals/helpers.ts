import type { Point } from '@/design/components';
import { formatDay } from '@/design/components';
import type { Goal } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

export type GoalStatusKind = 'onTrack' | 'behind' | 'done' | 'paused';

export function goalSaved(goalId: string, snapshot: Snapshot): bigint {
  return snapshot.allocations
    .filter((a) => a.goalId === goalId)
    .reduce((s, a) => {
      const amount = BigInt(a.amountMinor);
      return a.kind === 'spend' ? s - amount : s + amount;
    }, 0n);
}

export function goalProgress(saved: bigint, target: bigint): number {
  if (target <= 0n) return 0;
  const ratio = Number((saved * 10000n) / target) / 10000;
  return Math.min(1, Math.max(0, ratio));
}

/** Whole months from start to target date (inclusive minimum 1). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T12:00:00Z`);
  const to = new Date(`${toIso}T12:00:00Z`);
  if (to <= from) return 1;
  return Math.max(1, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()));
}

export function monthlyNeeded(saved: bigint, target: bigint, today: string, targetDate?: string): bigint | null {
  if (!targetDate || saved >= target) return null;
  const months = monthsBetween(today, targetDate);
  const left = target - saved;
  return left / BigInt(months) + (left % BigInt(months) > 0n ? 1n : 0n);
}

export type GoalCard = {
  goal: Goal;
  saved: bigint;
  target: bigint;
  progress: number;
  monthly: bigint | null;
  accountName: string;
};

export function goalCards(snapshot: Snapshot, today: string): GoalCard[] {
  const accounts = new Map(snapshot.accounts.map((a) => [a.id, a.name]));
  return snapshot.goals.map((goal) => {
    const saved = goalSaved(goal.id, snapshot);
    const target = BigInt(goal.targetMinor);
    return {
      goal,
      saved,
      target,
      progress: goalProgress(saved, target),
      monthly: monthlyNeeded(saved, target, today, goal.targetDate),
      accountName: accounts.get(goal.accountId) ?? '',
    };
  });
}

export function activeGoals(cards: GoalCard[]) {
  return cards
    .filter((c) => c.goal.status === 'active' || c.goal.status === 'paused')
    .sort((a, b) => {
      const aBehind = a.goal.targetDate && a.saved < a.target ? 0 : 1;
      const bBehind = b.goal.targetDate && b.saved < b.target ? 0 : 1;
      if (aBehind !== bBehind) return aBehind - bBehind;
      return (a.goal.targetDate ?? '9999').localeCompare(b.goal.targetDate ?? '9999');
    });
}

export function completedGoals(cards: GoalCard[]) {
  return cards
    .filter((c) => c.goal.status === 'completed')
    .sort((a, b) => (b.goal.completedAt ?? '').localeCompare(a.goal.completedAt ?? ''));
}

/** Projected date the schedule reaches the target at the given rate (PU-33). */
export function reachesByDate(saved: bigint, target: bigint, amountPerPeriod: bigint, every: 'week' | 'month', fromIso: string): string | null {
  if (amountPerPeriod <= 0n || saved >= target) return null;
  const left = target - saved;
  const periods = Number(left / amountPerPeriod + (left % amountPerPeriod > 0n ? 1n : 0n));
  if (every === 'week') {
    const d = new Date(`${fromIso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + periods * 7);
    return d.toISOString().slice(0, 10);
  }
  const [y, m, day] = fromIso.split('-').map(Number) as [number, number, number];
  const targetDate = new Date(Date.UTC(y, m - 1 + periods, 1));
  const last = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0)).getUTCDate();
  const d = Math.min(day, last);
  return `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** DESIGN page 14 status pill: On track, Behind, Done, or Paused. */
export function goalStatusKind(card: GoalCard, today: string): GoalStatusKind {
  if (card.goal.status === 'completed') return 'done';
  if (card.goal.status === 'paused') return 'paused';
  if (card.goal.targetDate && card.goal.targetDate < today && card.saved < card.target) return 'behind';
  const monthly = card.monthly;
  const sched = card.goal.scheduleAmountMinor ? BigInt(card.goal.scheduleAmountMinor) : null;
  if (monthly && sched !== null && sched < monthly) return 'behind';
  return 'onTrack';
}

export function statusPillFor(kind: GoalStatusKind): { labelKey: 'goals.onTrack' | 'goals.behind' | 'goals.done' | 'goals.paused'; pill: 'pending' | 'due-soon' | 'done' | 'problem' } {
  switch (kind) {
    case 'done':
      return { labelKey: 'goals.done', pill: 'done' };
    case 'behind':
      return { labelKey: 'goals.behind', pill: 'due-soon' };
    case 'paused':
      return { labelKey: 'goals.paused', pill: 'problem' };
    default:
      return { labelKey: 'goals.onTrack', pill: 'pending' };
  }
}

/** Cumulative saved amount after each allocation (DESIGN #30 progress line). */
export function goalProgressPoints(goalId: string, snapshot: Snapshot, today: string): Point[] {
  const rows = snapshot.allocations.filter((a) => a.goalId === goalId).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let running = 0n;
  const points: Point[] = [];
  for (const row of rows) {
    const amount = BigInt(row.amountMinor);
    running = row.kind === 'spend' ? running - amount : running + amount;
    points.push({ label: formatDay(row.date), value: running });
  }
  if (points.length === 0) points.push({ label: formatDay(today), value: 0n });
  return points;
}

export function gridColumns(size: 'phone' | 'tablet' | 'desktop' | 'wide'): number {
  if (size === 'wide' || size === 'desktop') return 3;
  if (size === 'tablet') return 2;
  return 1;
}
