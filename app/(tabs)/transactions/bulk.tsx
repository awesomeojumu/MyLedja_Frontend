import { Redirect } from "expo-router";

/** Selecting several transactions now happens on the Transactions list itself (Select, or long-press a row). */
export default function BulkRoute() {
  return <Redirect href="/(tabs)/transactions" />;
}
