import {
  accountActivity,
  groupAccounts,
  initials,
  issues,
  primaryAccount,
  subLine,
  toViews,
  totals,
  visibleSplit,
} from "@/features/accounts/services/accounts-view";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = new Date(2026, 9, 20, 12);
const at = (month: number, day: number) => new Date(2026, month, day, 10).toISOString();

const accounts = [
  { id: "gt", name: "GTBank", kind: "bank", institution: "GTBank", mask: "4821", connectionType: "linked" as const, balance: "14000.00", externalBalance: "14250.00" },
  { id: "cash", name: "Cash", kind: "cash", balance: "0.00" },
  { id: "old", name: "Old wallet", kind: "wallet", institution: "OPay", balance: "0.00" },
  { id: "ef", name: "Emergency fund", kind: "savings", institution: "PiggyVest", balance: "150000.00", reconciledAsOf: "2026-10-01T00:00:00.000Z" },
  { id: "ada", name: "Ada owes me", kind: "receivable", balance: "5000.00" },
  { id: "card", name: "Access card", kind: "liability", institution: "Access", mask: "0193", balance: "15000.00" },
  { id: "gone", name: "Closed", kind: "bank", balance: "0.00", archived: true },
];
const txns = [
  { id: "1", type: "expense", amount: "5000.00", accountId: "gt", occurredAt: at(9, 18) },
  { id: "2", type: "expense", amount: "1000.00", accountId: "gt", occurredAt: at(9, 19) },
  { id: "3", type: "transfer", amount: "20000.00", accountId: "gt", toAccountId: "ef", occurredAt: at(9, 2) },
  { id: "4", type: "income", amount: "9999.00", accountId: "gt", occurredAt: at(9, 20), status: "pending" },
  { id: "5", type: "expense", amount: "300.00", accountId: "cash", occurredAt: at(8, 25) },
];

const activity = accountActivity(txns, now);
assert(activity.change.get("gt") === -26000, "expenses and a transfer out this month; pending ignored");
assert(activity.change.get("ef") === 20000, "transfer in counts for the receiving account");
assert(!activity.change.has("cash") && activity.last.has("cash"), "last month's activity is remembered but not this month's change");

const views = toViews(accounts, txns, new Set(["ef"]), now);
assert(views.length === 6, "archived accounts are left out");
const by = (id: string) => views.find((v) => v.id === id)!;
assert(by("card").signed === -15000 && by("card").change === null, "liabilities count negative and have no change line");
assert(by("ada").group === "receivable", "receivable has its own group, not cash");
assert(by("gt").mismatch === 250, "bank says ₦250 more than we do");
assert(by("old").empty && !by("cash").empty, "₦0 with no recent activity is empty; recent activity keeps it visible");
assert(by("ef").pinned, "pinned from the saved set");

const t = totals(views);
assert(t.have === 169000 && t.owe === 15000 && t.netWorth === 154000, "net worth is what you have minus what you owe");
assert(t.parts.map((p) => p.key).join(",") === "cash,savings,receivable,liability", "composition parts in order");

const byType = groupAccounts(views, "type", "balance");
assert(byType.map((g) => g.label).join("|") === "Cash & bank|Savings|Owed to you|You owe", "type groups in a fixed order");
assert(byType[0].accounts.map((a) => a.id).join(",") === "gt,cash,old", "largest first, empty last");
assert(byType[3].total === -15000, "owed group total is negative");
const byBank = groupAccounts(views, "bank", "name");
assert(byBank[0].label === "PiggyVest", "bank groups by total, biggest first");
assert(byBank.some((g) => g.label === "Cash & wallets"), "accounts without a bank fall under Cash & wallets");
assert(groupAccounts(views, "type", "balance", "piggy")[0].accounts[0].id === "ef", "search matches the institution");

const many = Array.from({ length: 7 }, (_, i) => ({ ...views[0], id: `a${i}`, pinned: false, empty: i >= 5 }));
const split = visibleSplit(many);
assert(split.shown.length === 4 && split.hidden === 3 && split.hiddenEmpty === 2, "top four, then show more with the empty count");
assert(visibleSplit(many.slice(0, 5)).hidden === 0, "never hide just one account");

assert(issues(views).length === 1 && primaryAccount(views)?.id === "gt", "the account needing attention comes first");
assert(primaryAccount(views.map((v) => ({ ...v, mismatch: null })))?.id === "gt", "otherwise the biggest bank account");
assert(initials("GTBank") === "GT" && initials("First Bank") === "FB" && initials("") === "?", "tile initials");
assert(subLine(by("gt")) === "•••• 4821 · Linked", "card number and connection");
assert(subLine(by("ef")) === "PiggyVest · Reconciled 1 Oct", "institution and reconcile date");
assert(subLine(by("cash")) === "Manual", "manual cash");

console.log("accounts-view: activity, totals, groups, show more, attention, labels");
