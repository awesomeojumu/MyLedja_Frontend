import { Redirect } from "expo-router";

/** Filters now open as a sheet over the Transactions list. */
export default function FiltersRoute() {
  return <Redirect href="/(tabs)/transactions" />;
}
