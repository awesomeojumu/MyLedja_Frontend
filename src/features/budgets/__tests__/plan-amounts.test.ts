import { fillFrom, monthLabel, shiftMonth, spendByMonth, suggestion } from "@/features/budgets/services/plan-amounts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(shiftMonth("2026-01", -1) === "2025-12" && shiftMonth("2026-12", 1) === "2027-01", "months step across years");
assert(monthLabel("2026-10") === "October 2026" && monthLabel("2026-10", false) === "October", "labels");

const at = (m: number, d: number) => new Date(2026, m, d, 12).toISOString();
const spend = spendByMonth([
  { id: "1", type: "expense", amount: "20000.00", categoryId: "tr", occurredAt: at(6, 3) },
  { id: "2", type: "expense", amount: "30000.00", categoryId: "tr", occurredAt: at(7, 9) },
  { id: "3", type: "expense", amount: "52000.00", categoryId: "tr", occurredAt: at(8, 14) },
  { id: "4", type: "refund", amount: "2000.00", categoryId: "tr", occurredAt: at(8, 15) },
  { id: "5", type: "expense", amount: "9999.00", categoryId: "tr", occurredAt: at(8, 16), status: "voided" },
  { id: "6", type: "income", amount: "1000.00", categoryId: "tr", occurredAt: at(8, 16) },
  { id: "7", type: "expense", amount: "500.00", occurredAt: at(8, 16) },
]);
const s = suggestion(spend, "tr", "2026-10");
assert(s.history.map((h) => h.month).join(",") === "2026-07,2026-08,2026-09", "three months before, oldest first");
assert(s.lastMonth === 50000, "last month nets the refund and skips voided and income");
assert(s.average === 33500, "average of 20k, 30k, 50k rounded to ₦500");
assert(suggestion(spend, "none", "2026-10").average === 0, "no history, no suggestion");

const filled = fillFrom(["tr", "none"], (id) => suggestion(spend, id, "2026-10").lastMonth);
assert(filled.tr === 50000 && !("none" in filled), "fill skips empty categories");

console.log("plan-amounts: months, spend by month, suggestions, fill");
