import { Redirect } from "expo-router";

/** Budgets are monthly now: creating one opens the month planner. */
export default function BudgetAddRoute() {
  return <Redirect href="/(tabs)/budget/create" />;
}
