export const FEATURE_FOLDERS = [
  "auth-onboarding",
  "dashboard",
  "accounts",
  "transactions",
  "categories-merchants",
  "budgets",
  "bills",
  "plans-goals",
  "income",
  "debts",
  "savings",
  "investments",
  "taxes",
  "financial-health",
  "notifications",
  "settings-privacy",
  "help-support",
] as const;

export type FeatureFolder = (typeof FEATURE_FOLDERS)[number];

function span(start: number, end: number): string[] {
  const ids: string[] = [];
  for (let n = start; n <= end; n += 1) {
    ids.push(String(n).padStart(3, "0"));
  }
  return ids;
}

export const FEATURE_SCREENS: Record<FeatureFolder, readonly string[]> = {
  "auth-onboarding": [...span(1, 10), "141", "142", "143"],
  dashboard: [...span(11, 17), "145"],
  accounts: [...span(18, 27), "146", "147", "148", "149"],
  transactions: [...span(28, 41), "152"],
  "categories-merchants": span(42, 47),
  budgets: span(48, 57),
  bills: [...span(58, 66), "150"],
  "plans-goals": span(67, 74),
  income: span(75, 81),
  debts: [...span(82, 89), "151"],
  savings: span(90, 96),
  investments: span(97, 104),
  taxes: span(105, 109),
  "financial-health": [...span(110, 117), "153", "154"],
  notifications: span(118, 121),
  "settings-privacy": [...span(122, 137), "144"],
  "help-support": span(138, 140),
};

export const SCREEN_TITLES: Record<string, string> = {
  "001": "Welcome",
  "002": "Create account",
  "003": "Verify identity",
  "004": "Sign in",
  "005": "Start recovery",
  "006": "Recovery and reset",
  "007": "Terms and privacy",
  "008": "Initial preferences",
  "009": "Create workspace",
  "010": "Setup checklist",
  "141": "Splash",
  "142": "Multi-factor challenge",
  "143": "Passkey",
  "011": "Home",
  "012": "Cash flow",
  "013": "Net worth",
  "014": "Upcoming",
  "015": "Goals",
  "016": "Insights",
  "017": "Quick add",
  "145": "Global search",
};

export const NESTED_ROUTES = [
  "app/(tabs)/plan/_layout.tsx",
  "app/(tabs)/plan/index.tsx",
  "app/(tabs)/plan/budgets.tsx",
  "app/(tabs)/plan/bills.tsx",
  "app/(tabs)/plan/goals.tsx",
  "app/(tabs)/plan/income.tsx",
  "app/(tabs)/plan/debts.tsx",
  "app/(tabs)/more/_layout.tsx",
  "app/(tabs)/more/index.tsx",
  "app/(tabs)/more/savings.tsx",
  "app/(tabs)/more/investments.tsx",
  "app/(tabs)/more/taxes.tsx",
  "app/(tabs)/more/reports.tsx",
  "app/(tabs)/more/notifications.tsx",
  "app/(tabs)/more/settings.tsx",
  "app/(tabs)/more/help.tsx",
  "app/(tabs)/transactions/index.tsx",
  "app/(tabs)/transactions/categories.tsx",
  "app/(tabs)/accounts/index.tsx",
] as const;

export function allScreenIds(): string[] {
  return FEATURE_FOLDERS.flatMap((feature) => [...FEATURE_SCREENS[feature]]);
}

export function featureForScreen(id: string): FeatureFolder | undefined {
  return FEATURE_FOLDERS.find((feature) => FEATURE_SCREENS[feature].includes(id));
}
