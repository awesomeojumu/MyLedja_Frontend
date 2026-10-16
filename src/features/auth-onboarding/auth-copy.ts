import type { IconName } from "../../design";

export type BrandKind = "default" | "welcomeBack" | "recovery" | "setup";

export const BRAND: Record<BrandKind, { title: string; body: string }> = {
  default: {
    title: "Know where every naira goes.",
    body: "Record cash, transfers and bills in seconds. Works offline and stays exact to the kobo.",
  },
  welcomeBack: {
    title: "Welcome back.",
    body: "Your records are waiting, exactly as you left them.",
  },
  recovery: {
    title: "Let’s get you back in.",
    body: "We will never ask for your bank password, PIN or a code from your bank.",
  },
  setup: {
    title: "Almost there.",
    body: "A few choices now save you time every day.",
  },
};

export const TRUST_BULLETS: { icon: IconName; label: string }[] = [
  { icon: "shield-check", label: "No bank passwords, ever" },
  { icon: "cloud-off", label: "Works offline, syncs when you’re back" },
  { icon: "circle-check", label: "Every amount exact to the kobo" },
];

export const BRAND_FOOTER = "Naira-first. Exact to the kobo.";

export const TERMS_POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield-check", title: "No bank passwords, ever", body: "You type your records in. We never ask for bank logins, PINs or OTPs." },
  { icon: "ban", title: "Your data is not for sale", body: "We don’t sell or share your financial records." },
  { icon: "mail", title: "Take it with you", body: "Export everything or delete your account from Settings." },
  { icon: "cloud-off", title: "Works offline", body: "Records save on this phone first and sync when you’re back online." },
];

export const PASSKEY_POINTS = [
  "Works with the lock you already use on this phone",
  "Your password still works as a backup",
  "Remove it any time in Settings, then Security",
];

export const WELCOME_PREVIEW = [
  { title: "Jollof rice and c…", category: "Eating out", method: "Cash", amount: -4500, time: "12:40" },
  { title: "October salary", category: "Salary", method: "Main ac…", amount: 350000, time: "09:00" },
  { title: "Data bundle", category: "Data & airtime", method: "Cash", amount: -2000, time: "Yesterday" },
] as const;

export const PASSWORD_RULE_LABELS = {
  minLength: "At least 10 characters",
  hasNumber: "Includes a number",
  notNameOrEmail: "Not your name or email",
} as const;
