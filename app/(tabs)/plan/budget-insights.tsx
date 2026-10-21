import { Redirect } from "expo-router";

/** Budget insights are now Overspending for the month. */
export default function Route() {
  return <Redirect href="/(tabs)/budget/overspending" />;
}
