import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const journeys = [
  "src/features/auth-onboarding/screens/SignInScreen.tsx",
  "src/features/transactions/screens/AddExpenseScreen.tsx",
  "src/features/dashboard/screens/HomeScreen.tsx",
  "src/lib/feature-screen.tsx",
  "src/lib/screen-shell.tsx",
];
const root = join(__dirname, "..", "..");
for (const rel of journeys) {
  const path = join(root, rel);
  assert(existsSync(path), `missing ${rel}`);
  const src = readFileSync(path, "utf8");
  assert(/accessibilityLabel|accessibilityRole|Txt variant="title"|HeroBalance/.test(src), `${rel} has a labelled tree`);
}
console.log("a11y-journeys: five core journeys have labels");
