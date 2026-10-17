export function lockScreenCopy(title: string, hideAmounts: boolean): string {
  if (!hideAmounts) return title;
  if (/₦|\d{2,}/.test(title)) {
    return title.replace(/₦[\d,]+(\.\d+)?/g, "").replace(/\d{2,}/g, "").replace(/\s+/g, " ").trim();
  }
  return title;
}

export function lockScreenSafe(title: string, hideAmounts: boolean): boolean {
  if (!hideAmounts) return true;
  return !/₦|\d{2,}/.test(title);
}
