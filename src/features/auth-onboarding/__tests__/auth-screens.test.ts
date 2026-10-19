import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");

const files: [string, string[]][] = [
  ["src/features/auth-onboarding/screens/CreateWorkspaceScreen.tsx", ["getWorkspace", "updateWorkspace", "Save workspace", "Coming later"]],
  ["src/features/auth-onboarding/screens/MfaScreen.tsx", ["backupCode", "Verify and sign in"]],
  ["app/(auth)/mfa.tsx", ["challengeId", "completeMfa"]],
  ["app/(auth)/sign-in.tsx", ["MfaRequiredError", "AUTH_ROUTES.mfa"]],
  ["src/features/auth-onboarding/screens/PasskeyScreen.tsx", ["Create passkey", "Not now", "onSkip", "onCreate"]],
  ["app/(auth)/passkey.tsx", ["passkeyStart", "passkeyFinish", "onSkip", "padB64"]],
  ["src/features/settings-privacy/screens/SecurityScreen.tsx", ["startTotp", "confirmTotp", "Turn on authenticator"]],
];

for (const [rel, needles] of files) {
  const path = join(root, rel);
  assert(existsSync(path), `missing ${rel}`);
  const src = readFileSync(path, "utf8");
  for (const needle of needles) {
    assert(src.includes(needle), `${rel} must include ${needle}`);
  }
}

console.log("auth-screens: 009/142/143 wired");
