export type PlanRole = "list" | "detail" | "create" | "edit" | "period" | "remaining" | "history" | "overspent" | "accounts" | "insights" | "action";

export interface PlanScreenSpec {
  path: string;
  role: PlanRole;
  empty: string;
}

const BUDGET: Record<string, PlanRole> = {
  "048": "list",
  "049": "detail",
  "050": "create",
  "051": "edit",
  "052": "period",
  "053": "remaining",
  "054": "history",
  "055": "overspent",
  "056": "accounts",
  "057": "insights",
};

export function planScreenSpec(id: string, title: string): PlanScreenSpec | null {
  const path = pathFor(id);
  if (!path) return null;
  const role = BUDGET[id] ?? roleFromTitle(title);
  return { path, role, empty: `No ${title.toLowerCase()} yet` };
}

export function budgetViewKeys(): readonly ["day", "week", "month", "year"] {
  return ["day", "week", "month", "year"];
}

function pathFor(id: string): string | null {
  const n = Number(id);
  if (id === "150") return "bills";
  if (id === "151") return "debts";
  if (n >= 48 && n <= 57) return "budgets";
  if (n >= 58 && n <= 66) return "bills";
  if (n >= 67 && n <= 74) return "goals";
  if (n >= 75 && n <= 81) return "income-streams";
  if (n >= 82 && n <= 89) return "debts";
  return null;
}

function roleFromTitle(title: string): PlanRole {
  const lower = title.toLowerCase();
  if (lower.startsWith("add ")) return "create";
  if (lower.startsWith("edit ")) return "edit";
  if (lower.includes("remaining")) return "remaining";
  if (lower.includes("history") || lower.includes("schedule") || lower.includes("calendar")) return "history";
  if (lower.includes("overspent") || lower.includes("missed") || lower.includes("completed")) return "overspent";
  if (lower.includes("insights") || lower.includes("expected") || lower.includes("progress")) return "insights";
  if (lower.includes("accounts") || lower.includes("tax class")) return "accounts";
  if (lower.includes("period")) return "period";
  if (
    lower === "budget" ||
    lower === "bill" ||
    lower === "goal" ||
    lower === "income stream" ||
    lower === "debt"
  ) {
    return "detail";
  }
  if (lower.startsWith("mark ") || lower.startsWith("allocate") || lower.startsWith("match") || lower.startsWith("borrow") || lower.startsWith("repay") || lower.startsWith("lend") || lower.startsWith("collect")) {
    return "action";
  }
  return "list";
}
