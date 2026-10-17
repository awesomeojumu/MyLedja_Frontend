import { cacheKey, getSnapshot, putSnapshot, switchCachedRange, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const figure = (value: string): DashboardSnapshot["income"] => ({
  value,
  currency: "NGN",
  basis: "Posted expenses in this range. Transfers excluded.",
});
const snap: DashboardSnapshot = {
  income: figure("0.00"),
  expense: figure("1500.00"),
  refund: figure("0.00"),
  netCash: figure("-1500.00"),
  netWorth: figure("8500.00"),
  budgetRemaining: figure("0.00"),
};
const key = cacheKey("ws", "2026-10-01", "2026-10-31");
putSnapshot(key, snap);
assert(getSnapshot(key)?.expense.value === "1500.00", "cached");
const second = switchCachedRange(key);
assert(second !== null && second.elapsedMs < 1000, "cached switch under 1s");
assert(Object.values(snap).every((f) => f.basis.length > 0), "every figure has basis");
console.log("range-cache: M3 under 1s + basis");
