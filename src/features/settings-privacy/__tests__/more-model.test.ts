import { alertCount, displayName, healthLabel, holdingsValue, savingsTotal } from "@/features/settings-privacy/services/more-model";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(healthLabel(85) === "Strong" && healthLabel(68) === "Good" && healthLabel(45) === "Fair" && healthLabel(10) === "Needs work", "score bands");

const savings = savingsTotal([
  { id: "a", kind: "savings", balance: "150000.00" },
  { id: "b", kind: "savings", balance: "5000.00", archived: true },
  { id: "c", kind: "bank", balance: "14000.00" },
]);
assert(savings.total === 150000 && savings.count === 1, "live savings accounts only");

const held = holdingsValue([
  { value: "220000.00", capital: "200000.00" },
  { value: "200000.00", capital: "207000.00" },
]);
assert(held.value === 420000 && held.count === 2, "holdings value");
assert(held.gainPct != null && Math.abs(held.gainPct - (13000 / 407000) * 100) < 1e-9, "gain against capital");
assert(holdingsValue([]).gainPct === null, "no holdings, no return");

assert(alertCount([{ kind: "bill" }, { kind: "budget" }, { kind: "summary" }]) === 2, "summary isn't an alert");

assert(displayName("ayo.bami@example.com") === "Ayo Bami", "name from email");
assert(displayName("12345@example.com") === "12345@example.com", "digits only keeps the address");
assert(displayName(null) === "Your account", "no email");

console.log("more-model: health label, savings, holdings, alerts, name");
