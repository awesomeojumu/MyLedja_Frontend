import { nairaText, remainingText } from "@/lib/budget-text";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(nairaText("2500.00") === "₦2,500.00", "views read as naira");
assert(nairaText("1250450.5") === "₦1,250,450.50", "thousands and kobo");
assert(nairaText(undefined) === "—", "missing is a dash, not ₦0.00");
assert(nairaText("abc") === "—", "garbage is a dash");
assert(remainingText("26300.00") === "₦26,300.00 left", "remaining is formatted");
assert(remainingText("-1200.00") === "Over by ₦1,200.00", "overspend says so");

console.log("budget-text: naira budget figures");
