import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const home = readFileSync(join(root, "src/features/dashboard/screens/HomeScreen.tsx"), "utf8");
const upcoming = readFileSync(join(root, "src/features/dashboard/screens/UpcomingScreen.tsx"), "utf8");
const insights = readFileSync(join(root, "src/features/dashboard/screens/InsightsScreen.tsx"), "utf8");
const preview = readFileSync(join(root, "src/features/dashboard/screens/GoalsPreviewScreen.tsx"), "utf8");
assert(home.includes('requestAdd("expense")') && home.includes('requestAdd("income")'), "011 opens the add sheet from Home");
assert(home.includes("/(tabs)/cash-flow"), "011 links to cash flow");
assert(home.includes("/(tabs)/upcoming"), "011 links to upcoming");
assert(home.includes("/(tabs)/insights"), "011 links to insights");
assert(upcoming.includes('filter="upcoming"'), "014 uses the 14-day bill filter");
assert(upcoming.includes('title="Upcoming"'), "014 title is Upcoming");
assert(!upcoming.includes("PlanLiveList"), "014 is not a raw bill list");
assert(preview.includes("listGoals"), "015 loads goals");
assert(preview.includes("row.saved"), "015 shows saved");
assert(preview.includes("ProgressBar"), "015 shows saved vs target");
assert(preview.includes("See all goals"), "015 is a glance, not the full list");
assert(preview.includes("slice(0, 3)"), "015 keeps three open goals");
assert(preview.includes("goal-detail"), "015 opens a goal");
assert(!preview.includes("PlanLiveList"), "015 is not a raw list");
assert(!preview.includes("Add goal"), "015 does not replace the plan list");
assert(insights.includes("listBudgets"), "016 loads budgets");
assert(insights.includes("getBudget"), "016 reads planned and spent");
assert(insights.includes("No budget yet"), "016 empty state");
assert(!insights.includes("PlanLiveList"), "016 is not a raw budget list");
console.log("dashboard-screens: 011 links, 014 upcoming, 015 goals, 016 insights");
