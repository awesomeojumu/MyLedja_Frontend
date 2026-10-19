import { healthModel, healthReportText, previousMonthBounds, runwayMonths } from "@/features/financial-health/services/health-model";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(runwayMonths(300, 100) === 3, "runway 3 months");
assert(runwayMonths(100, 0) === null, "no spend does not divide");

const full = healthModel({
  budgetRemaining: "10.00",
  cash: "300.00",
  expense: "100.00",
  goals: [{ saved: "50.00", target: "100.00" }],
  missedBills: 0,
});
assert(full.score === 88, `score was ${full.score}`);
assert(full.parts.length === 4, "four parts");
assert(full.advice.length === 0, "nothing to change");

const thin = healthModel({
  budgetRemaining: "-1.00",
  cash: "10.00",
  expense: "100.00",
  goals: [{ id: "g1", saved: "0.00", target: "100.00" }],
  missedBills: 1,
});
assert(thin.score === 0, "weak month scores 0");
assert(thin.advice[0]?.key === "runway", "runway first");
assert(thin.advice[1]?.key === "bills", "missed bill second");
assert(thin.advice[2]?.href.includes("g1") === true, "empty goal opens that goal");

const scaled = healthModel({
  budgetRemaining: "1.00",
  cash: "300.00",
  expense: "100.00",
  goals: [],
  missedBills: 0,
  settings: { budget: true, runway: true, goals: false, bills: true },
});
assert(scaled.parts.every((row) => row.key !== "goals"), "goals off");
assert(scaled.score === 100, "three good parts scale to 100");

const missing = healthModel({
  budgetRemaining: null,
  cash: "0.00",
  expense: "0.00",
  goals: [],
  missedBills: 0,
});
assert(missing.parts.find((row) => row.key === "budget")?.reason === "Not enough data", "missing budget");
assert(missing.parts.find((row) => row.key === "runway")?.reason === "No spend this month", "no spend");

const prev = previousMonthBounds(new Date("2026-10-19T12:00:00.000Z"));
assert(prev.from.startsWith("2026-09-01"), "previous month");
assert(healthReportText({ income: "1", expense: "2", netWorth: "3", runway: "4", score: 10, reasons: ["ok"] }).includes("Score 10"), "report text");

console.log("health-model: score, runway, advice, settings");
