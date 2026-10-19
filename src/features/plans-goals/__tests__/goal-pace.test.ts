import { goalNudge, goalPace } from "@/features/plans-goals/services/goal-pace";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-10-19T12:00:00.000Z");
const due = new Date(now.getTime() + 180 * 86_400_000).toISOString().slice(0, 10);
const car = goalPace({
  name: "Car",
  target: 18_000_000,
  saved: 0,
  dueAt: due,
  now,
});
assert(car.daysLeft === 180, `180 days, got ${car.daysLeft}`);
assert(Math.round(car.perDay ?? 0) === 100_000, `100k a day, got ${car.perDay}`);

assert(goalPace({ target: 100, saved: 40, dueAt: null }).daysLeft === null, "no date");
assert(goalPace({ target: 100, saved: 20, dueAt: "2026-10-18", now }).overdue === true, "overdue");

const week = goalNudge([{ name: "Car", target: 18_000_000, saved: 0, dueAt: "2026-10-26" }], now);
assert(week?.text.includes("7 days") === true, "week mark");
assert(goalNudge([{ name: "Car", target: 18_000_000, saved: 0, dueAt: "2026-10-25" }], now) === null, "day 6 is quiet");

console.log("goal-pace: days, per day, integral nudge");
