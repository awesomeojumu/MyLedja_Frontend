import { isComplete } from "../otp";
import { passwordPasses, type PasswordRuleSet } from "./password-rules";

export const AUTH_ROUTES = {
  welcome: "/(auth)",
  signIn: "/(auth)/sign-in",
  signUp: "/(auth)/sign-up",
  verify: "/(auth)/verify",
  terms: "/(auth)/terms",
  passkey: "/(auth)/passkey",
  preferences: "/(auth)/preferences",
  workspace: "/(auth)/workspace",
  checklist: "/(auth)/checklist",
  mfa: "/(auth)/mfa",
  recover: "/(auth)/recover",
  reset: "/(auth)/reset",
  splash: "/(auth)/splash",
  home: "/(tabs)",
  catalog: "/catalog",
} as const;

export type AuthHref = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];

export type WorkspaceKind = "personal" | "family" | "business";

export function signupPath(): AuthHref[] {
  return [
    AUTH_ROUTES.signUp,
    AUTH_ROUTES.verify,
    AUTH_ROUTES.terms,
    AUTH_ROUTES.passkey,
    AUTH_ROUTES.preferences,
    AUTH_ROUTES.workspace,
    AUTH_ROUTES.checklist,
    AUTH_ROUTES.splash,
    AUTH_ROUTES.home,
  ];
}

export function afterSignUp(): typeof AUTH_ROUTES.verify {
  return AUTH_ROUTES.verify;
}

export function afterVerify(): typeof AUTH_ROUTES.terms {
  return AUTH_ROUTES.terms;
}

export function afterTerms(): typeof AUTH_ROUTES.passkey {
  return AUTH_ROUTES.passkey;
}

export function afterPasskey(): typeof AUTH_ROUTES.preferences {
  return AUTH_ROUTES.preferences;
}

export function afterPreferences(): typeof AUTH_ROUTES.workspace {
  return AUTH_ROUTES.workspace;
}

export function afterWorkspace(): typeof AUTH_ROUTES.checklist {
  return AUTH_ROUTES.checklist;
}

export function afterChecklist(): typeof AUTH_ROUTES.splash {
  return AUTH_ROUTES.splash;
}

export function afterSplash(): typeof AUTH_ROUTES.home {
  return AUTH_ROUTES.home;
}

/** MFA is not built yet (ADR-0004 roadmap), so sign-in goes straight to the splash. */
export function afterSignIn(): typeof AUTH_ROUTES.splash {
  return AUTH_ROUTES.splash;
}

export function afterMfa(): typeof AUTH_ROUTES.splash {
  return AUTH_ROUTES.splash;
}

export function afterRecover(): typeof AUTH_ROUTES.reset {
  return AUTH_ROUTES.reset;
}

export function afterReset(): typeof AUTH_ROUTES.signIn {
  return AUTH_ROUTES.signIn;
}

export function canCreateAccount(rules: PasswordRuleSet): boolean {
  return passwordPasses(rules);
}

export function canAgreeToTerms(agreed: boolean): boolean {
  return agreed;
}

export function canVerifyOtp(code: string): boolean {
  return isComplete(code);
}

export function workspaceSelectable(kind: WorkspaceKind | string): boolean {
  return kind === "personal";
}

export function canSubmitSignIn(identifier: string, password: string): boolean {
  return identifier.trim().length > 0 && password.length > 0;
}

export function canSaveNewPassword(code: string, rules: PasswordRuleSet): boolean {
  return isComplete(code) && passwordPasses(rules);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  return `${local[0] ?? ""}•••@${domain}`;
}

let rememberedEmail = "";
let rememberedName = "";

/** Display-only memory of what the user typed, for later onboarding copy. Never a password. */
export function rememberSignup(name: string, email: string): void {
  rememberedName = name.trim() || rememberedName;
  rememberedEmail = email.trim() || rememberedEmail;
}

export function rememberedSignup(): { name: string; email: string } {
  return { name: rememberedName, email: rememberedEmail };
}

export function forgetSignup(): void {
  rememberedName = "";
  rememberedEmail = "";
}
