import { nairaAmount, type ApiTransaction } from "@/lib/money-map";

/** "2026-10" for a date, in local time. */
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The month `n` months before (negative) or after (positive) "YYYY-MM". */
export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + n, 1));
}

export function monthLabel(key: string, withYear = true): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: withYear ? "numeric" : undefined });
}

/** Posted spending per category per month: refunds come off, voided and pending rows don't count. */
export function spendByMonth(txns: ApiTransaction[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const t of txns) {
    if (t.status && t.status !== "posted") continue;
    if (!t.categoryId || !t.occurredAt) continue;
    if (t.type !== "expense" && t.type !== "refund") continue;
    const at = new Date(t.occurredAt);
    if (Number.isNaN(at.getTime())) continue;
    const key = monthKeyOf(at);
    const month = out.get(key) ?? new Map<string, number>();
    const amount = nairaAmount(t.amount) * (t.type === "refund" ? -1 : 1);
    month.set(t.categoryId, (month.get(t.categoryId) ?? 0) + amount);
    out.set(key, month);
  }
  return out;
}

export interface Suggestion {
  /** The three months before the one being planned, oldest first, with what was spent in each. */
  history: { month: string; spent: number }[];
  lastMonth: number;
  /** Average of those three months, rounded to the nearest ₦500. */
  average: number;
}

export function suggestion(spend: Map<string, Map<string, number>>, categoryId: string, planningMonth: string): Suggestion {
  const history = [-3, -2, -1].map((n) => {
    const month = shiftMonth(planningMonth, n);
    return { month, spent: Math.max(0, spend.get(month)?.get(categoryId) ?? 0) };
  });
  const avg = history.reduce((s, h) => s + h.spent, 0) / history.length;
  return { history, lastMonth: history[2].spent, average: Math.round(avg / 500) * 500 };
}

/** Fill every spending category from a rule; categories with nothing to suggest are left out. */
export function fillFrom(categoryIds: string[], pick: (id: string) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of categoryIds) {
    const v = Math.round(pick(id));
    if (v > 0) out[id] = v;
  }
  return out;
}
