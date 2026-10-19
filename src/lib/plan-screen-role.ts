export type PlanRole = "list" | "detail" | "create" | "edit" | "period" | "remaining" | "history" | "overspent" | "accounts" | "insights" | "action";

export interface PlanScreenSpec {
  path: string;
  role: PlanRole;
  empty: string;
}

const INCOME: Record<string, PlanRole> = {
  "075": "list",
  "076": "detail",
  "077": "create",
  "078": "edit",
  "079": "insights",
  "080": "action",
  "081": "accounts",
};

const DEBT: Record<string, PlanRole> = {
  "082": "list",
  "083": "detail",
  "084": "create",
  "085": "create",
  "086": "action",
  "087": "action",
  "088": "action",
  "089": "action",
  "151": "history",
};

const BUDGET: Record<string, PlanRole> = {
  "048": "list",
  "049": "create",
  "050": "edit",
  "051": "edit",
  "052": "detail",
  "053": "period",
  "054": "overspent",
  "055": "edit",
  "056": "history",
  "057": "action",
};

export function planScreenSpec(id: string, title: string): PlanScreenSpec | null {
  const path = pathFor(id);
  if (!path) return null;
  const role = BUDGET[id] ?? INCOME[id] ?? DEBT[id] ?? roleFromTitle(title);
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
  if (id === "075") return "income";
  if (id === "076") return "income-detail";
  if (id === "077") return "income-add";
  if (id === "078") return "income-edit";
  if (id === "079") return "income-expected";
  if (id === "080") return "income-match";
  if (id === "081") return "income-tax";
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
