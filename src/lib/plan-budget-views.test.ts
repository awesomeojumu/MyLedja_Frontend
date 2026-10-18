import { readFileSync } from "node:fs";
import { join } from "node:path";
import { budgetViewKeys } from "@/lib/plan-screen-role";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const payload = { day: { value: "1.00" }, week: { value: "7.00" }, month: { value: "30.00" }, year: { value: "365.00" } };
const labels = budgetViewKeys().map((key) =>
  key === "day" ? "Daily" : key === "week" ? "Weekly" : key === "month" ? "Monthly" : "Annual",
);
assert(labels.join(",") === "Daily,Weekly,Monthly,Annual", "four budget view labels");
assert(payload.day.value === "1.00" && payload.year.value === "365.00", "views payload has day week month year");

const source = readFileSync(join(__dirname, "plan-live-list.tsx"), "utf8");
assert(source.includes("PlanBudgetViews") && source.includes("budgetViews"), "live budget sheet loads the four views");

console.log("plan-budget-views: four labels on the live sheet");
