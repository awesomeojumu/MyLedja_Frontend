import { nairaAmount } from "@/lib/money-map";

/** One category's line in a month's budget, as numbers. */
export interface Line {
  categoryId: string;
  name: string;
  planned: number;
  spent: number;
}

export function toLines(raw: { categoryId: string; name: string; planned: string; spent: string }[] | undefined): Line[] {
  return (raw ?? []).map((l) => ({ categoryId: l.categoryId, name: l.name, planned: nairaAmount(l.planned), spent: nairaAmount(l.spent) }));
}

export interface Pace {
  left: number;
  /** Spend at the current rate by month end. */
  projected: number;
  over: boolean;
  /** Not over yet, but the projection goes past the plan. */
  fast: boolean;
  /** How much over the plan the projection lands (0 when it doesn't). */
  projectedOver: number;
  /** What's left per remaining day, never below 0. */
  perDay: number;
  daysLeft: number;
}

/** `today` is the day of the month (1-based); past months pass daysInMonth, future months 0. */
export function pace(line: Line, today: number, daysInMonth: number): Pace {
  const left = line.planned - line.spent;
  const elapsed = Math.min(Math.max(today, 0), daysInMonth);
  const projected = elapsed > 0 ? (line.spent / elapsed) * daysInMonth : line.spent;
  const over = line.planned > 0 ? line.spent > line.planned : line.spent > 0;
  const daysLeft = Math.max(0, daysInMonth - elapsed);
  // Early in the month a single purchase swings the forecast wildly, so wait until a few days have passed.
  const fast = !over && elapsed >= 5 && daysLeft > 0 && line.planned > 0 && projected > line.planned * 1.02;
  return {
    left,
    projected,
    over,
    fast,
    projectedOver: Math.max(0, Math.round(projected - line.planned)),
    perDay: daysLeft > 0 ? Math.max(0, left) / daysLeft : 0,
    daysLeft,
  };
}

export interface Overspend {
  over: (Line & { by: number })[];
  fast: (Line & { projectedOver: number })[];
  totalOver: number;
}

export function overspend(lines: Line[], today: number, daysInMonth: number): Overspend {
  const over: (Line & { by: number })[] = [];
  const fast: (Line & { projectedOver: number })[] = [];
  for (const l of lines) {
    const p = pace(l, today, daysInMonth);
    if (p.over) over.push({ ...l, by: l.spent - l.planned });
    else if (p.fast) fast.push({ ...l, projectedOver: p.projectedOver });
  }
  over.sort((a, b) => b.by - a.by);
  fast.sort((a, b) => b.projectedOver - a.projectedOver);
  return { over, fast, totalOver: over.reduce((s, l) => s + l.by, 0) };
}

/** Where money can come from: categories with room left (biggest first), then the month's unplanned money. */
export function coverSources(lines: Line[], targetId: string, unplanned: number): { id: string; name: string; available: number }[] {
  const out = lines
    .filter((l) => l.categoryId !== targetId && l.planned - l.spent > 0)
    .map((l) => ({ id: l.categoryId, name: l.name, available: l.planned - l.spent }))
    .sort((a, b) => b.available - a.available);
  if (unplanned > 0) out.push({ id: "unplanned", name: "Not planned yet", available: unplanned });
  return out;
}

/**
 * Move `amount` into the target category's plan, taking it from `sourceId` (a category, or "unplanned" for money
 * not yet planned). Never takes more than the source has left. Returns the month's new lines for saving.
 */
export function moveMoney(
  plan: { categoryId: string; planned: number }[],
  targetId: string,
  sourceId: string,
  amount: number,
  sourceAvailable: number,
): { categoryId: string; planned: number }[] {
  const moved = Math.max(0, Math.min(Math.round(amount), Math.floor(sourceAvailable)));
  const next = plan.map((l) => ({ ...l }));
  const target = next.find((l) => l.categoryId === targetId);
  if (target) target.planned += moved;
  else next.push({ categoryId: targetId, planned: moved });
  if (sourceId !== "unplanned") {
    const source = next.find((l) => l.categoryId === sourceId);
    if (source) source.planned -= moved;
  }
  return next.filter((l) => l.planned > 0);
}
