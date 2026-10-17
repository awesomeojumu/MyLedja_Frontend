import { nairaAmount, planMoney, planName, rowKind, toLedgerAccount } from "@/lib/money-map";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(nairaAmount("20000.00") === 20000, "parses naira strings");
assert(nairaAmount("20,000.50") === 20000.5, "strips commas");
assert(rowKind("refund") === "income", "refund is income");
assert(rowKind("transfer") === "transfer", "transfer stays transfer");
assert(rowKind("expense") === "expense", "expense stays expense");
const account = toLedgerAccount({ id: "a1", name: "GTBank", kind: "cash", institution: "GTBank", balance: "20000.00" });
assert(account.balance === 20000, "account balance is a number");
assert(account.statusLine.includes("cash"), "status line has kind");
assert(planName({ name: "Rent" }) === "Rent", "plan name");
assert(planMoney({ amount: "1500.00" }) === 1500, "plan money");
console.log("money-map: naira, kinds, account and plan rows");
