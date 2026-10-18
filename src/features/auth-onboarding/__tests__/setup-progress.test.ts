import {
  afterSetupSave,
  canContinue,
  deriveSetup,
  EMPTY_SETUP,
  markSetup,
  nextSetupStep,
  setupHref,
  setupSteps,
} from "@/features/auth-onboarding/services/setup-progress";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(nextSetupStep(EMPTY_SETUP)?.key === "currency", "currency is first");
const afterAccount = markSetup(markSetup(EMPTY_SETUP, "currency"), "firstAccount");
assert(nextSetupStep(afterAccount)?.key === "opening", "checklist resumes at opening");
assert(setupSteps(afterAccount).filter((step) => step.done).length === 2, "two steps done");
assert(nextSetupStep({ ...EMPTY_SETUP, currency: true, firstAccount: true, opening: true, categories: true, firstTransaction: true }) === null, "complete setup has no next step");

const derived = deriveSetup(
  { ...EMPTY_SETUP, currency: true },
  { accounts: 1, opening: true, categories: 0, transactions: 1 },
);
assert(derived.firstAccount && derived.opening && derived.firstTransaction, "data marks the done steps");
assert(nextSetupStep(derived)?.key === "categories", "60% asks for the remaining step only");
assert(setupHref("firstAccount") === "/(tabs)/accounts/add?from=setup", "main action opens the form");
assert(afterSetupSave("setup") === "/(auth)/checklist", "save returns to the checklist");
assert(canContinue(false) === false, "Continue stays off until progress is known");
assert(canContinue(true) === true, "Continue follows a known checklist");

console.log("setup-progress: resume, skip, derive, routes");
