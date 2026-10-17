import { EMPTY_SETUP, markSetup, nextSetupStep, setupSteps } from "@/features/auth-onboarding/services/setup-progress";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(nextSetupStep(EMPTY_SETUP)?.key === "currency", "currency is first");
const afterAccount = markSetup(markSetup(EMPTY_SETUP, "currency"), "firstAccount");
assert(nextSetupStep(afterAccount)?.key === "opening", "checklist resumes at opening");
assert(setupSteps(afterAccount).filter((step) => step.done).length === 2, "two steps done");
assert(nextSetupStep({ ...EMPTY_SETUP, currency: true, firstAccount: true, opening: true, categories: true, firstTransaction: true }) === null, "complete setup has no next step");
console.log("setup-progress: resume and skip");
