import {
  AUTH_ROUTES,
  afterChecklist,
  afterMfa,
  afterPasskey,
  afterPreferences,
  afterRecover,
  afterReset,
  afterSignIn,
  afterSignUp,
  afterSplash,
  afterTerms,
  afterVerify,
  afterWorkspace,
  canAgreeToTerms,
  canCreateAccount,
  canSaveNewPassword,
  canSubmitSignIn,
  canVerifyOtp,
  dummyOtpAccepts,
  maskEmail,
  signupPath,
  workspaceSelectable,
} from "../services/auth-flow";
import { passwordPasses, passwordRules } from "../services/password-rules";

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assertEqual(AUTH_ROUTES.welcome, "/(auth)");
assertEqual(AUTH_ROUTES.signIn, "/(auth)/sign-in");
assertEqual(AUTH_ROUTES.signUp, "/(auth)/sign-up");
assertEqual(AUTH_ROUTES.verify, "/(auth)/verify");
assertEqual(AUTH_ROUTES.terms, "/(auth)/terms");
assertEqual(AUTH_ROUTES.passkey, "/(auth)/passkey");
assertEqual(AUTH_ROUTES.preferences, "/(auth)/preferences");
assertEqual(AUTH_ROUTES.workspace, "/(auth)/workspace");
assertEqual(AUTH_ROUTES.checklist, "/(auth)/checklist");
assertEqual(AUTH_ROUTES.mfa, "/(auth)/mfa");
assertEqual(AUTH_ROUTES.recover, "/(auth)/recover");
assertEqual(AUTH_ROUTES.reset, "/(auth)/reset");
assertEqual(AUTH_ROUTES.splash, "/(auth)/splash");
assertEqual(AUTH_ROUTES.home, "/(tabs)");
assertEqual(AUTH_ROUTES.catalog, "/catalog");
assert(!("pinCreate" in AUTH_ROUTES), "PIN routes are gone");
assert(!("pinConfirm" in AUTH_ROUTES), "PIN confirm route is gone");

assertEqual(
  signupPath().join(" > "),
  [
    AUTH_ROUTES.signUp,
    AUTH_ROUTES.verify,
    AUTH_ROUTES.terms,
    AUTH_ROUTES.passkey,
    AUTH_ROUTES.preferences,
    AUTH_ROUTES.workspace,
    AUTH_ROUTES.checklist,
    AUTH_ROUTES.splash,
    AUTH_ROUTES.home,
  ].join(" > "),
);

assertEqual(afterSignUp(), AUTH_ROUTES.verify);
assertEqual(afterVerify(), AUTH_ROUTES.terms);
assertEqual(afterTerms(), AUTH_ROUTES.passkey);
assertEqual(afterPasskey(), AUTH_ROUTES.preferences);
assertEqual(afterPreferences(), AUTH_ROUTES.workspace);
assertEqual(afterWorkspace(), AUTH_ROUTES.checklist);
assertEqual(afterChecklist(), AUTH_ROUTES.splash);
assertEqual(afterSplash(), AUTH_ROUTES.home);
assertEqual(afterSignIn(), AUTH_ROUTES.mfa);
assertEqual(afterMfa(), AUTH_ROUTES.splash);
assertEqual(afterRecover(), AUTH_ROUTES.reset);
assertEqual(afterReset(), AUTH_ROUTES.signIn);

const weak = passwordRules("Adaeze", "Adaeze Okafor", "adaeze@example.com");
assert(!weak.minLength, "short passwords fail length");
assert(!weak.hasNumber, "no digit fails number");
assert(!weak.notNameOrEmail, "name in the password fails");
assert(!passwordPasses(weak), "weak passwords cannot continue");
assert(!canCreateAccount(weak), "create-account stays disabled");

const shortButNotName = passwordRules("ok", "Adaeze Okafor", "adaeze@example.com");
assert(shortButNotName.notNameOrEmail, "a short password that is not the name still passes that rule");
assert(!passwordPasses(shortButNotName), "still needs length and a number");

const strong = passwordRules("Ledja2026", "Adaeze Okafor", "adaeze@example.com");
assert(strong.minLength, "eight or more");
assert(strong.hasNumber, "includes a number");
assert(strong.notNameOrEmail, "not the name or email");
assert(passwordPasses(strong), "all three checks pass");
assert(canCreateAccount(strong), "create-account enables");

assert(!canAgreeToTerms(false), "Agree stays disabled until the first box");
assert(canAgreeToTerms(true), "ticking terms enables continue");

assert(!canVerifyOtp("4821"), "partial OTP keeps Verify disabled");
assert(canVerifyOtp("482193"), "six digits enable Verify");
assert(dummyOtpAccepts("000000"), "dummy OTP accepts any six digits");
assert(!dummyOtpAccepts("12"), "short codes fail");

assert(workspaceSelectable("personal"), "Personal is selectable");
assert(!workspaceSelectable("family"), "Family is coming later");
assert(!workspaceSelectable("business"), "Business is coming later");

assert(!canSubmitSignIn("", "secret"), "sign-in needs an identifier");
assert(!canSubmitSignIn("adaeze@example.com", ""), "sign-in needs a password");
assert(canSubmitSignIn("adaeze@example.com", "x"), "any non-empty pair continues");

assert(!canSaveNewPassword("482193", shortButNotName), "reset needs a passing password");
assert(!canSaveNewPassword("4821", strong), "reset needs six code digits");
assert(canSaveNewPassword("482193", strong), "code plus passing password saves");

assertEqual(maskEmail("adaeze@example.com"), "a•••@example.com");
assertEqual(maskEmail("a@example.com"), "a•••@example.com");

console.log("auth-flow: signup path, password rules, terms, OTP, workspace, recovery");
