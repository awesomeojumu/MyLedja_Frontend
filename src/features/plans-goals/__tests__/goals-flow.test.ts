import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/plans-goals/screens/goal-screens.tsx"), "utf8");
assert(!src.includes("FeatureScreen"), "goals must not use FeatureScreen");
for (const needle of [
  "listGoals",
  "createGoal",
  "target",
  "getGoal",
  "patchGoal",
  "allocateGoal",
  "scheduleGoal",
  "No completed goals.",
  "Add goal",
  "Due date",
  "Need each day",
]) {
  assert(src.includes(needle), `goals must include ${needle}`);
}
assert(existsSync(join(root, "src/features/plans-goals/screens/HubScreen.tsx")), "hub");
console.log("goals-flow: 067-074 wired");
