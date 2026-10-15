import { activeFromPath } from "./tab-route";

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

console.log("tab-route: pathname maps onto the five destinations");
