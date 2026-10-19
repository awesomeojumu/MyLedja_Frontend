const COOKIE = "myledja_rt";
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export function readSessionCookie(cookieHeader: string): string | null {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== COOKIE) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export function sessionCookieWrite(token: string, https: boolean): string {
  const secure = https ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function sessionCookieClear(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function persistWebRefresh(token: string): void {
  try {
    globalThis.localStorage?.setItem("myledja.refreshToken", token);
  } catch {
    /* private mode */
  }
  if (typeof document === "undefined") return;
  document.cookie = sessionCookieWrite(token, globalThis.location?.protocol === "https:");
}

export function readWebRefresh(): string | null {
  try {
    const stored = globalThis.localStorage?.getItem("myledja.refreshToken");
    if (stored) return stored;
  } catch {
    /* private mode */
  }
  if (typeof document === "undefined") return null;
  return readSessionCookie(document.cookie);
}

export function clearWebRefresh(): void {
  try {
    globalThis.localStorage?.removeItem("myledja.refreshToken");
    globalThis.localStorage?.removeItem("myledja.session.identity");
  } catch {
    /* private mode */
  }
  if (typeof document === "undefined") return;
  document.cookie = sessionCookieClear();
}
