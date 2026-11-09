// Expanded local list and pattern check matching backend (TECH-SPEC 10 & common-passwords.ts).
const COMMON = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  'password1!',
  'passw0rd123',
  '1234567890',
  '0123456789',
  '0987654321',
  '9876543210',
  '12345678910',
  '123456789a',
  'a123456789',
  '1q2w3e4r5t',
  '1qaz2wsx3edc',
  'qwertyuiop',
  'qwerty1234',
  'qwerty12345',
  '1234qwer',
  'asdfghjkl1',
  'zxcvbnm123',
  'iloveyou12',
  'iloveyou123',
  'princess123',
  'football123',
  'baseball123',
  'sunshine123',
  'welcome123',
  'welcome1234',
  'letmein123',
  'monkey12345',
  'dragon12345',
  'abcdefghij',
  'abcd123456',
  'abc1234567',
  'abcdef1234',
  'aa12345678',
  'qazwsxedc123',
  'administrator',
  'admin12345',
  'changeme123',
  'trustno1234',
  'superman123',
  'computer123',
  'jesusislord',
  'godisgood123',
  'blessing123',
  'nigeria123',
  'nigeria1234',
  'lagos12345',
  'naija12345',
  'myledja123',
  'myledja1234',
]);

export function isCommonPassword(password: string): boolean {
  const p = password.toLowerCase();
  if (COMMON.has(p)) return true;
  if (/^(.)\1+$/.test(p)) return true;
  if (/^(..?.?)\1+$/.test(p)) return true;
  const digits = '01234567890123456789';
  const reversed = '98765432109876543210';
  if (/^\d+$/.test(p) && (digits.includes(p) || reversed.includes(p))) return true;
  return false;
}

export type PasswordRules = { length: boolean; mixed: boolean; common: boolean };
export type Strength = 'weak' | 'okay' | 'strong';

export function checkPassword(pw: string): { rules: PasswordRules; strength: Strength; ok: boolean } {
  const rules = {
    length: pw.length >= 10,
    mixed: /[A-Za-z]/.test(pw) && /\d/.test(pw),
    common: pw.length > 0 && !isCommonPassword(pw),
  };
  const ok = rules.length && rules.common;
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const hasMixedCase = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const strength: Strength = !ok
    ? 'weak'
    : rules.mixed && (pw.length >= 14 || (pw.length >= 10 && (hasSpecial || hasMixedCase)))
      ? 'strong'
      : 'okay';
  return { rules, strength, ok };
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
