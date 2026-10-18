import { formatDateDMY, toIsoDate } from "@/design/format";
import { nairaAmount, planMoney, planMoneyOrNull, planName, rowKind, toLedgerAccount } from "@/lib/money-map";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(nairaAmount("20000.00") === 20000, "parses naira strings");
assert(nairaAmount("20,000.50") === 20000.5, "strips commas");
assert(nairaAmount("4500.50") === 4500.5, "keeps kobo");
assert(nairaAmount("₦4,500.50") === 4500.5, "strips the naira sign");
assert(rowKind("refund") === "income", "refund is income");
assert(rowKind("transfer") === "transfer", "transfer stays transfer");
assert(rowKind("expense") === "expense", "expense stays expense");
const account = toLedgerAccount({ id: "a1", name: "GTBank", kind: "cash", institution: "GTBank", balance: "20000.00" });
assert(account.balance === 20000, "account balance is a number");
assert(account.statusLine.includes("cash"), "status line has kind");
assert(planName({ name: "Rent" }) === "Rent", "plan name");
assert(planName({ counterparty: "Tunde" }) === "Tunde", "debt counterparty");
const budget = { id: "01a14d5e-77ce-750e-a2ad-d3fe6a9cbbf2", accountId: "acc-1", primaryPeriod: "month", amount: "20000.00" };
assert(planName(budget, { "acc-1": "GTBank Salary" }) === "GTBank Salary · monthly budget", "budget reads as account and period");
assert(planName(budget) === "Account · monthly budget", "budget without the account list still has no raw id");
assert(!planName({ id: "01a14d5e-77ce-750e-a2ad-d3fe6a9cbbf2" }).includes("01a14d5e"), "never a raw id");
assert(planMoney({ amount: "1500.00" }) === 1500, "plan money");
assert(planMoneyOrNull({ target: "7500.50" }) === 7500.5, "goal target");
assert(planMoneyOrNull({ principal: "1200.00" }) === 1200, "debt principal");
assert(planMoneyOrNull({ name: "No amount" }) === null, "a missing amount is null, not zero");
assert(formatDateDMY("2026-10-17") === "17/10/2026", "ISO shows as DD/MM/YYYY");
assert(formatDateDMY("17/10/2026") === "17/10/2026", "display date stays DD/MM/YYYY");
assert(toIsoDate(new Date(2026, 9, 17)) === "2026-10-17", "storage stays ISO");
console.log("money-map: naira, kinds, account and plan rows");
