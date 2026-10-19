import { flattenSearch, searchGroups, searchHref } from "@/features/transactions/services/search-hits";
import { unsyncedSignOutFooter } from "@/features/transactions/services/sync-queue-copy";
import { nairaAmount } from "@/lib/money-map";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const hits = flattenSearch({
  transactions: [],
  accounts: [{ id: "acc-1", label: "GTBank Salary" }],
  bills: [],
  goals: [],
  debts: [],
});
assert(hits.some((row) => row.label === "GTBank Salary" && row.kind === "account"), "gtb finds the account");
assert(searchGroups(hits).some((group) => group.kind === "account"), "accounts have their own group");

const money = flattenSearch({
  transactions: [{ id: "tx-1", label: "Shoprite", amount: "4500.50", type: "expense" }],
});
assert(nairaAmount(money[0].amount) === 4500.5, "search keeps 4500.50");
assert(nairaAmount(money[0].amount) !== 0, "search amount is not ₦0");

const debtOnly = flattenSearch({
  accounts: [{ id: "acc-t", label: "Tunde", kind: "liability" }],
  debts: [{ id: "d-t", label: "Tunde" }],
});
assert(debtOnly.filter((row) => row.label === "Tunde").length === 1, "Tunde is only under Debts");
assert(debtOnly[0].kind === "debt", "shadow liability accounts stay out of search");
assert(unsyncedSignOutFooter(0) === false, "empty queue has no unsynced footer");
assert(unsyncedSignOutFooter(1) === true, "queued rows show the footer");

assert(searchHref({ id: "g1", label: "Rent", kind: "goal" }).includes("goal-detail?id=g1"), "search opens the goal");
assert(searchHref({ id: "b1", label: "NEPA", kind: "bill" }).includes("bill-detail?id=b1"), "search opens the bill");

console.log("search-hits: five groups and transaction amount");
