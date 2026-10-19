import { readFileSync } from "node:fs";
import { join } from "node:path";
import { preferencesPatch } from "@/features/auth-onboarding/services/preferences-patch";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const body = preferencesPatch({
  currency: "NGN",
  locale: "en-NG",
  timezone: "Africa/Lagos",
  weekStartsOn: "sunday",
  reminders: { bills: false, budget: true, summary: true },
});

assert(body.defaultCurrency === "NGN", "currency is saved");
assert(body.locale === "en-NG", "language is saved");
assert(body.timezone === "Africa/Lagos", "time zone is saved");
assert(body.weekStartsOn === "sunday", "week start is saved");
assert(body.reminders.bills === false && body.reminders.budget === true && body.reminders.summary === true, "reminder toggles are saved");
assert(body.setupProgress.currency === true, "currency step is marked done");
assert(!("security" in body.reminders), "security alerts stay always on");

const route = readFileSync(join(__dirname, "..", "..", "..", "..", "app/(auth)/preferences.tsx"), "utf8");
assert(route.includes("preferencesPatch"), "008 route sends the full preferences body");
assert(route.includes("await session.patchSetup"), "008 waits for the save before continuing");

console.log("preferences-patch: 008 saves currency, locale, timezone, week start, and reminders");
