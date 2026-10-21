import { Redirect } from "expo-router";

/** Budgets are monthly now: this month lives in the Budget tab. */
export default function Route() {
  return <Redirect href="/(tabs)/budget" />;
}
