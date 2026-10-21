import { Redirect } from "expo-router";

/** Overspend analysis is now Overspending for the month. */
export default function Route() {
  return <Redirect href="/(tabs)/budget/overspending" />;
}
