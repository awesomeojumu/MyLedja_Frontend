import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { journeyNames, READER_JOURNEYS } from "@/lib/a11y-walkthrough";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

assert(READER_JOURNEYS.length === 5, "five core journeys");
assert(journeyNames("sign-in").includes("Email") && journeyNames("sign-in").includes("Password"), "sign-in names");

const inputs = read("src/design/components/inputs.tsx");
assert(inputs.includes("textContentType") && inputs.includes("textContentTypeFor"), "email/password get iOS textContentType");
assert(inputs.includes("Secure text field"), "password field hint for TalkBack");

const signIn = read("src/features/auth-onboarding/screens/SignInScreen.tsx");
assert(signIn.includes('autoComplete="email"') && signIn.includes('autoComplete="current-password"'), "sign-in fields declare purpose");

const nav = read("src/design/components/navigation.tsx");
assert(nav.includes("accessibilityRole=\"tab\"") && nav.includes("Selected"), "tabs announce selected");
assert(nav.includes("Opens add expense"), "+ has a VoiceOver hint");

const hero = read("src/design/components/money.tsx");
assert(hero.includes("Balance hidden") && hero.includes("Balance ${"), "Home balance has a spoken name");
assert(hero.includes("accessibilityLabel={spoken}"), "Recent rows read name and type");

const toast = read("src/design/components/surfaces.tsx");
assert(toast.includes("accessibilityLiveRegion"), "toasts are announced");

const search = read("src/features/transactions/screens/SearchScreen.tsx");
assert(search.includes("Find a record"), "search field name");

const overlay = read("src/features/dashboard/components/GlobalSearchOverlay.tsx");
assert(overlay.includes("Find a record"), "home search uses the same field name");

const views = read("src/lib/plan-budget-views.tsx");
assert(views.includes("accessibilityLabel") && views.includes("VIEW_LABEL"), "budget views have spoken names");

for (const rel of [
  "src/features/auth-onboarding/screens/SignInScreen.tsx",
  "src/features/transactions/screens/AddExpenseScreen.tsx",
  "src/features/dashboard/screens/HomeScreen.tsx",
  "src/lib/feature-screen.tsx",
  "src/lib/screen-shell.tsx",
]) {
  assert(existsSync(join(root, rel)), `missing ${rel}`);
}

console.log("a11y-journeys: five core journeys have VoiceOver and TalkBack names");
