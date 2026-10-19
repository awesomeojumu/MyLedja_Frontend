import { splitCopy, splitInvestmentReturn } from "@/features/investments/services/return-split";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const win = splitInvestmentReturn(10000, 13000);
assert(win.capitalReturned === 10000, "capital comes back first");
assert(win.profit === 3000, "extra is profit");
assert(win.shortfall === 0, "no shortfall on a gain");
assert(splitCopy(win).includes("Profit"), "profit copy");

const loss = splitInvestmentReturn(10000, 9000);
assert(loss.capitalReturned === 9000, "only what came back");
assert(loss.profit === 0, "no profit");
assert(loss.shortfall === 1000, "1,000 still out");
assert(splitCopy(loss).includes("Shortfall"), "shortfall copy");

const even = splitInvestmentReturn(10000, 10000);
assert(even.profit === 0 && even.shortfall === 0, "even return");

console.log("return-split: capital, profit, shortfall");
