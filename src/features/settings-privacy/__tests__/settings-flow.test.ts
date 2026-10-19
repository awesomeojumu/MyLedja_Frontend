import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_SCREENS } from "@/lib/screen-catalog";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/settings-privacy/screens/settings-screens.tsx"), "utf8");

assert(!src.includes("SettingsLiveScreen"), "settings must not use SettingsLiveScreen stub");

for (const needle of [
  "Screen122Profile",
  "Screen123WorkspaceSwitcher",
  "Screen124WorkspaceSettings",
  "Screen125Members",
  "Screen126Regional",
  "Screen127SecurityOverview",
  "Screen128SessionsDevices",
  "Screen129CredentialsRecovery",
  "Screen130PrivacyCentre",
  "Screen131ExportData",
  "Screen132DeactivateAccount",
  "Screen133PermanentDeletion",
  "Screen134Integrations",
  "Screen135SubscriptionPlan",
  "Screen136AppPreferences",
  "Screen137AboutDiagnostics",
  "Screen144SuspiciousSignins",
  "Profile",
  "Workspace switcher",
  "Workspace settings",
  "Members and roles",
  "Regional settings",
  "Security overview",
  "Sessions and devices",
  "Credentials and recovery",
  "Privacy centre",
  "Export data",
  "Deactivate account",
  "Permanent deletion",
  "Integrations",
  "Subscription and plan",
  "App preferences",
  "About, legal and diagnostics",
  "New device and suspicious sign-in review",
]) {
  assert(src.includes(needle), `settings must include ${needle}`);
}

const settingsIds = FEATURE_SCREENS["settings-privacy"];
for (const id of settingsIds) {
  const file = join(root, "src/features/settings-privacy/screens", `screen-${id}.tsx`);
  assert(existsSync(file), `missing screen-${id}`);
  const body = readFileSync(file, "utf8");
  assert(body.includes("settings-screens"), `screen-${id} must import from settings-screens`);
}

console.log("settings-flow: 122-137 and 144 wired");
