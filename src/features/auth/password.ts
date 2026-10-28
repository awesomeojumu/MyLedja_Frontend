// A short local list for instant feedback; the server checks a full list (TECH-SPEC 10).
const COMMON = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  '1234567890',
  '12345678910',
  'qwertyuiop',
  'iloveyou12',
  'abcdefghij',
  'football123',
  'welcome123',
  'naija12345',
]);

export type PasswordRules = { length: boolean; mixed: boolean; common: boolean };
export type Strength = 'weak' | 'okay' | 'strong';

export function checkPassword(pw: string): { rules: PasswordRules; strength: Strength; ok: boolean } {
  const rules = {
    length: pw.length >= 10,
    mixed: /[A-Za-z]/.test(pw) && /\d/.test(pw),
    common: pw.length > 0 && !COMMON.has(pw.toLowerCase()),
  };
  const ok = rules.length && rules.common;
  const strength: Strength = !ok ? 'weak' : rules.mixed && (pw.length >= 14 || /[^A-Za-z0-9]/.test(pw)) ? 'strong' : 'okay';
  return { rules, strength, ok };
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
