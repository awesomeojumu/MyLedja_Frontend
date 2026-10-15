export const OTP_LENGTH = 6;

export function appendDigit(code: string, digit: string, length = OTP_LENGTH): string {
  if (!/^[0-9]$/.test(digit)) return code;
  if (code.length >= length) return code;
  return `${code}${digit}`;
}

export function deleteDigit(code: string): string {
  return code.slice(0, -1);
}

export function isComplete(code: string, length = OTP_LENGTH): boolean {
  return code.length === length;
}
