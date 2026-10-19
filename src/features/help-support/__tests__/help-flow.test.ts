import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_SCREENS } from "@/lib/screen-catalog";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/help-support/screens/help-screens.tsx"), "utf8");

assert(!src.includes("HelpCopyScreen"), "help must not use HelpCopyScreen stub");

for (const needle of [
  "Screen138HelpFaq",
  "Screen139ContactSupport",
  "Screen140LegalDocuments",
  "Help centre and FAQ",
  "Contact support",
  "Legal documents",
  "Terms of Service",
  "Privacy Policy",
]) {
  assert(src.includes(needle), `help must include ${needle}`);
}

const helpIds = FEATURE_SCREENS["help-support"];
for (const id of helpIds) {
  const file = join(root, "src/features/help-support/screens", `screen-${id}.tsx`);
  assert(existsSync(file), `missing screen-${id}`);
  const body = readFileSync(file, "utf8");
  assert(body.includes("help-screens"), `screen-${id} must import from help-screens`);
}

console.log("help-flow: 138-140 wired");
