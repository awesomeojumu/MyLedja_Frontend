import type { Goal } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

export function goalSaved(goalId: string, snapshot: Snapshot): bigint {
  return snapshot.allocations.filter((a) => a.goalId === goalId).reduce((s, a) => s + BigInt(a.amountMinor), 0n);
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
  return cards.filter((c) => c.goal.status === 'active');
}

export function completedGoals(cards: GoalCard[]) {
  return cards.filter((c) => c.goal.status === 'completed');
}
