export type PasswordRuleSet = {
  minLength: boolean;
  hasNumber: boolean;
  notNameOrEmail: boolean;
};

export function passwordRules(password: string, name: string, email: string): PasswordRuleSet {
  const namePart = name.trim().toLowerCase();
  const local = (email.split("@")[0] ?? "").trim().toLowerCase();
  const lower = password.toLowerCase();
  const containsName = namePart.length > 0 && lower.includes(namePart);
  const containsEmail = local.length > 0 && lower.includes(local);
  return {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    notNameOrEmail: !containsName && !containsEmail,
  };
}

export function passwordPasses(rules: PasswordRuleSet): boolean {
  return rules.minLength && rules.hasNumber && rules.notNameOrEmail;
}
