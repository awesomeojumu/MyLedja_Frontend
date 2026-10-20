import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const settings = readFileSync(join(__dirname, "..", "features/settings-privacy/screens/SettingsScreen.tsx"), "utf8");
assert(settings.includes("useScheme"), "Settings owns the scheme");
assert(settings.includes('accessibilityLabel="Theme"'), "Theme control is labelled");
assert(settings.includes("Light") && settings.includes("Dark"), "Light and Dark are both offered");

console.log("settings-theme: Settings has Light / Dark");
