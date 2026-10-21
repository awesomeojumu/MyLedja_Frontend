import { coverSources, moveMoney, overspend, pace } from "@/features/budgets/services/month-lines";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const lines = [
  { categoryId: "eat", name: "Eating out", planned: 40000, spent: 54000 },
  { categoryId: "tr", name: "Transport", planned: 55000, spent: 48000 },
  { categoryId: "fuel", name: "Fuel", planned: 25000, spent: 21000 },
  { categoryId: "gro", name: "Groceries", planned: 110000, spent: 48000 },
  { categoryId: "fam", name: "Family", planned: 30000, spent: 0 },
];

const tr = pace(lines[1], 21, 31);
assert(tr.left === 7000 && tr.daysLeft === 10 && tr.perDay === 700, "Transport has ₦7k left, ₦700 a day for 10 days");
assert(tr.fast && !tr.over && tr.projectedOver === 15857, "Transport is running fast: about ₦16k over by month end");
assert(pace(lines[3], 21, 31).fast === false, "Groceries is on track");
assert(pace({ ...lines[1], spent: 30000 }, 3, 31).fast === false, "too early in the month to call it fast");
assert(pace({ categoryId: "x", name: "X", planned: 0, spent: 500 }, 10, 30).over, "spending in an unplanned category is over");

const o = overspend(lines, 21, 31);
assert(o.over.length === 1 && o.over[0].categoryId === "eat" && o.over[0].by === 14000, "Eating out is ₦14k over");
assert(o.totalOver === 14000, "total over");
assert(o.fast.map((l) => l.categoryId).join(",") === "tr,fuel", "Transport then Fuel running fast");

const sources = coverSources(lines, "eat", 128000);
assert(sources[0].id === "gro" && sources[0].available === 62000, "biggest room first");
assert(sources[sources.length - 1].id === "unplanned", "unplanned money last");
assert(!sources.some((s) => s.id === "eat"), "can't cover from itself");

const plan = lines.map((l) => ({ categoryId: l.categoryId, planned: l.planned }));
const moved = moveMoney(plan, "eat", "gro", 14000, 62000);
assert(moved.find((l) => l.categoryId === "eat")!.planned === 54000 && moved.find((l) => l.categoryId === "gro")!.planned === 96000, "move from Groceries");
const capped = moveMoney(plan, "eat", "fam", 50000, 30000);
assert(capped.find((l) => l.categoryId === "eat")!.planned === 70000 && !capped.some((l) => l.categoryId === "fam"), "never more than the source has; emptied lines drop");
const fromFree = moveMoney(plan, "new", "unplanned", 5000, 128000);
assert(fromFree.find((l) => l.categoryId === "new")!.planned === 5000 && fromFree.length === plan.length + 1, "unplanned money adds a line");

console.log("month-lines: pace, overspend, cover sources, move money");
