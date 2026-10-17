export interface SetupProgress {
  currency: boolean;
  firstAccount: boolean;
  opening: boolean;
  categories: boolean;
  firstTransaction: boolean;
}

export const EMPTY_SETUP: SetupProgress = {
  currency: false,
  firstAccount: false,
  opening: false,
  categories: false,
  firstTransaction: false,
};

const STEPS: { key: keyof SetupProgress; title: string; body: string }[] = [
  { key: "currency", title: "Set your currency", body: "Amounts look like ₦1,250,450.50" },
  { key: "firstAccount", title: "Add your first account", body: "Bank, wallet or cash" },
  { key: "opening", title: "Set its opening balance", body: "What is in it today, to the kobo" },
  { key: "categories", title: "Check your categories", body: "25 ready-made, rename or add your own" },
  { key: "firstTransaction", title: "Record your first transaction", body: "Takes about 15 seconds" },
];

export function nextSetupStep(progress: SetupProgress) {
  return STEPS.find((step) => !progress[step.key]) ?? null;
}

export function setupSteps(progress: SetupProgress) {
  return STEPS.map((step) => ({ ...step, done: progress[step.key] }));
}

export function markSetup(progress: SetupProgress, key: keyof SetupProgress): SetupProgress {
  return { ...progress, [key]: true };
}
