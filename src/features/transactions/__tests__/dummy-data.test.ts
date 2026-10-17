import { formatMoney } from "@/design/format";
import { REVIEW_ROWS, SPLIT, TRANSACTIONS, nairaSum, transactionById } from "@/features/transactions/dummy-data";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(TRANSACTIONS.length >= 4, "At least four dummy transactions");
assert(
  TRANSACTIONS.every((row) => row.amount > 0),
  "Every row has a naira amount",
);
assert(TRANSACTIONS.some((row) => row.kind === "expense"), "An expense is present");
assert(TRANSACTIONS.some((row) => row.kind === "income"), "Income is present");
assert(transactionById("shoprite")?.title === "Shoprite", "Shoprite is findable");
assert(REVIEW_ROWS.length >= 1, "Needs-review has at least one row");
assert(Math.abs(SPLIT.reduce((sum, part) => sum + part.amount, 0) - 12500.5) < 0.001, "Split sums to Shoprite");
assert(formatMoney(nairaSum(TRANSACTIONS), "NGN").startsWith("₦") || formatMoney(nairaSum(TRANSACTIONS), "NGN").startsWith("−"), "Net uses naira");
assert(
  nairaSum([{ id: "t", title: "Move", category: "", account: "A", amount: 1000, kind: "transfer", time: "" }]) === 0,
  "Transfers leave income and expense unchanged",
);

console.log("transactions dummy data: naira rows, split, review");
