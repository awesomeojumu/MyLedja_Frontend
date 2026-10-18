import { activeFromPath, isTabRoot, showPhoneBar } from "@/lib/tab-route";

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

assertEqual(activeFromPath("/"), "home");
assertEqual(activeFromPath("/transactions"), "transactions");
assertEqual(activeFromPath("/plan"), "plan");
assertEqual(activeFromPath("/plan/budgets"), "plan");
assertEqual(activeFromPath("/accounts"), "accounts");
assertEqual(activeFromPath("/more"), "more");
assertEqual(activeFromPath("/more/settings"), "more");

assertEqual(isTabRoot("/accounts", "accounts"), true);
assertEqual(isTabRoot("/accounts/abc", "accounts"), false);
assertEqual(isTabRoot("/more/settings", "more"), false);
assertEqual(showPhoneBar("/more/settings"), false);
assertEqual(showPhoneBar("/"), true);

console.log("tab-route: pathname maps onto destinations; /more still routes");
