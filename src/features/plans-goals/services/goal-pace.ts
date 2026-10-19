export interface GoalPaceInput {
  name?: string;
  target: number;
  saved: number;
  dueAt?: string | null;
  now?: Date;
}

export interface GoalPace {
  daysLeft: number | null;
  perDay: number | null;
  overdue: boolean;
}

const NUDGE_DAYS = new Set([90, 30, 14, 7, 1]);

export function goalPace(input: GoalPaceInput): GoalPace {
  const remaining = Math.max(input.target - input.saved, 0);
  if (!input.dueAt) return { daysLeft: null, perDay: null, overdue: false };
  const due = Date.parse(`${input.dueAt.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(due)) return { daysLeft: null, perDay: null, overdue: false };
  const now = input.now ?? new Date();
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const daysLeft = Math.round((due - today) / 86_400_000);
  if (daysLeft <= 0) return { daysLeft, perDay: remaining, overdue: remaining > 0 };
  return { daysLeft, perDay: remaining / daysLeft, overdue: false };
}

export function goalNudge(goals: GoalPaceInput[], now = new Date()): { text: string } | null {
  const open = goals.filter((row) => row.target > row.saved);
  for (const row of open) {
    const pace = goalPace({ ...row, now });
    if (pace.overdue) return { text: `${row.name ?? "A goal"} is past its date.` };
    if (pace.daysLeft != null && NUDGE_DAYS.has(pace.daysLeft)) {
      return { text: `${row.name ?? "A goal"} has ${pace.daysLeft} day${pace.daysLeft === 1 ? "" : "s"} left.` };
    }
  }
  return null;
}
