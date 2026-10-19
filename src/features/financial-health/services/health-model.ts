export type HealthPart = "budget" | "runway" | "goals" | "bills";

export interface HealthSettings {
  budget: boolean;
  runway: boolean;
  goals: boolean;
  bills: boolean;
}

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  budget: true,
  runway: true,
  goals: true,
  bills: true,
};

export interface HealthInput {
  budgetRemaining?: string | null;
  cash: string;
  expense: string;
  goals: { id?: string; saved: string; target: string }[];
  missedBills: number;
  settings?: HealthSettings;
}

export interface HealthPartRow {
  key: HealthPart;
  points: number;
  max: number;
  reason: string;
}

export interface HealthResult {
  score: number;
  parts: HealthPartRow[];
  runwayMonths: number | null;
  advice: { key: string; text: string; href: string }[];
}

export function moneyNumber(value?: string | null): number {
  const n = Number.parseFloat(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export function runwayMonths(cash: number, expense: number): number | null {
  if (expense <= 0) return null;
  return cash / expense;
}

export function previousMonthBounds(now = new Date()): { from: string; to: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  return { from: start.toISOString(), to: end.toISOString() };
}

export function healthModel(input: HealthInput): HealthResult {
  const settings = input.settings ?? DEFAULT_HEALTH_SETTINGS;
  const cash = moneyNumber(input.cash);
  const expense = moneyNumber(input.expense);
  const months = runwayMonths(cash, expense);
  const parts: HealthPartRow[] = [];

  if (settings.budget) {
    if (input.budgetRemaining == null) {
      parts.push({ key: "budget", points: 0, max: 25, reason: "Not enough data" });
    } else {
      const remaining = moneyNumber(input.budgetRemaining);
      parts.push({
        key: "budget",
        points: remaining >= 0 ? 25 : 0,
        max: 25,
        reason: remaining >= 0 ? "Budget not overspent" : "Budget overspent",
      });
    }
  }

  if (settings.runway) {
    if (months == null) {
      parts.push({ key: "runway", points: 0, max: 25, reason: "No spend this month" });
    } else {
      parts.push({
        key: "runway",
        points: months >= 3 ? 25 : 0,
        max: 25,
        reason: months >= 3 ? "Runway at least 3 months" : "Runway under 3 months",
      });
    }
  }

  if (settings.goals) {
    if (input.goals.length === 0) {
      parts.push({ key: "goals", points: 0, max: 25, reason: "Not enough data" });
    } else {
      const ratios = input.goals.map((goal) => {
        const target = moneyNumber(goal.target);
        if (target <= 0) return 0;
        return Math.min(1, moneyNumber(goal.saved) / target);
      });
      const avg = ratios.reduce((sum, row) => sum + row, 0) / ratios.length;
      const points = Math.round(avg * 25);
      parts.push({ key: "goals", points, max: 25, reason: `Goals ${Math.round(avg * 100)}% funded` });
    }
  }

  if (settings.bills) {
    parts.push({
      key: "bills",
      points: input.missedBills === 0 ? 25 : 0,
      max: 25,
      reason: input.missedBills === 0 ? "No missed bills" : `${input.missedBills} missed bills`,
    });
  }

  const max = parts.reduce((sum, row) => sum + row.max, 0);
  const raw = parts.reduce((sum, row) => sum + row.points, 0);
  const score = max === 0 ? 0 : Math.round((raw / max) * 100);

  const advice: HealthResult["advice"] = [];
  if (months != null && months < 1) {
    advice.push({ key: "runway", text: "Cash lasts less than a month.", href: "/(tabs)/more/health-runway" });
  }
  if (input.missedBills > 0) {
    advice.push({ key: "bills", text: "A bill is overdue.", href: "/(tabs)/plan/bills-missed" });
  }
  const emptyGoal = input.goals.find((goal) => moneyNumber(goal.saved) === 0);
  if (emptyGoal) {
    const href = emptyGoal.id ? `/(tabs)/plan/goal-detail?id=${emptyGoal.id}` : "/(tabs)/plan/goals";
    advice.push({ key: "goals", text: "A goal has nothing saved yet.", href });
  }

  return { score, parts, runwayMonths: months, advice };
}

export function healthReportText(input: {
  income: string;
  expense: string;
  netWorth: string;
  runway: string;
  score: number;
  reasons: string[];
}): string {
  return [
    `Income ${input.income}`,
    `Expense ${input.expense}`,
    `Net worth ${input.netWorth}`,
    `Runway ${input.runway}`,
    `Score ${input.score}`,
    ...input.reasons,
  ].join("\n");
}
