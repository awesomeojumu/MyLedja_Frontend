import { isPortrait, navMode, phoneBarDestinations, splitLayout, twoColumn } from "@/lib/nav-mode";
import { shouldSkipRise } from "@/design/motion-policy";

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

assertEqual(navMode("compact"), "bottom");
assertEqual(navMode("medium"), "rail");
assertEqual(navMode("expanded"), "rail");
assertEqual(navMode("large"), "side");

assertEqual(phoneBarDestinations().join(","), "home,transactions,plan,accounts,more");

assertEqual(twoColumn("compact"), false);
assertEqual(twoColumn("medium"), false);
assertEqual(twoColumn("expanded"), true);
assertEqual(twoColumn("large"), true);

assertEqual(shouldSkipRise(false), false);
assertEqual(shouldSkipRise(true), true);

assertEqual(isPortrait(1280, 800), false, "Laptop landscape is not portrait");
assertEqual(isPortrait(800, 1280), true, "Laptop flipped to portrait");
assertEqual(isPortrait(1080, 1920), true, "1080p panel rotated");
assertEqual(isPortrait(1920, 1080), false, "1080p landscape");
assertEqual(isPortrait(390, 844), true, "Phone is portrait");

assertEqual(splitLayout("large", false), true, "Wide landscape keeps the brand pane");
assertEqual(splitLayout("expanded", false), true, "Expanded landscape keeps the brand pane");
assertEqual(splitLayout("medium", false), true, "Tablet landscape keeps the brand pane");
assertEqual(splitLayout("compact", false), false, "Phone never splits");
assertEqual(splitLayout("large", true), false, "Portrait laptop must not keep the side pane");
assertEqual(splitLayout("expanded", true), false, "1080-wide portrait must stack");
assertEqual(splitLayout("medium", true), false, "Tablet portrait must stack");

assertEqual(navMode("large", true), "bottom", "Portrait uses the phone bar, not the sidebar");
assertEqual(navMode("expanded", true), "bottom");
assertEqual(navMode("large", false), "side");

assertEqual(twoColumn("large", true), false, "Portrait does not two-column Home");
assertEqual(twoColumn("expanded", true), false);
assertEqual(twoColumn("large", false), true);

console.log("nav-mode: width classes map to bottom, rail, side; portrait stacks instead of splitting");
