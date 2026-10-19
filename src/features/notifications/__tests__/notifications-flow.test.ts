import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const list = readFileSync(join(root, "src/features/notifications/screens/notice-screens.tsx"), "utf8");
const prefs = readFileSync(join(root, "src/features/notifications/screens/prefs-screens.tsx"), "utf8");
const hub = readFileSync(join(root, "src/features/notifications/screens/HubScreen.tsx"), "utf8");

assert(!list.includes("SettingsLiveScreen") && !prefs.includes("SettingsLiveScreen"), "notifications are not the settings stub");
assert(!hub.includes("GatedCopy"), "the hub is the inbox");
for (const needle of ["Notifications", "Nothing needs you right now", "buildInbox", "Notification settings", "Lock screen alerts", "This alert has cleared"]) {
  assert(list.includes(needle), `inbox must include ${needle}`);
}
for (const needle of ["Save reminders", "Hide amounts", "patchSettings", "Security alerts", "Contents hidden"]) {
  assert(prefs.includes(needle), `settings must include ${needle}`);
}
for (const route of [
  "app/(tabs)/more/notifications.tsx",
  "app/(tabs)/more/notification.tsx",
  "app/(tabs)/more/notification-settings.tsx",
  "app/(tabs)/more/lock-screen.tsx",
]) {
  assert(existsSync(join(root, route)), `missing ${route}`);
}

console.log("notifications-flow: 118-121 wired");
