import { readSessionCookie, sessionCookieClear, sessionCookieWrite } from "@/lib/session-cookies";

function assertEqual(actual: string | null, expected: string | null, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

assertEqual(readSessionCookie(""), null, "empty");
assertEqual(readSessionCookie("other=1"), null, "other cookie");
assertEqual(readSessionCookie("myledja_rt=abc.def"), "abc.def", "plain token");
assertEqual(readSessionCookie("a=1; myledja_rt=tok%2B1; b=2"), "tok+1", "encoded");

const written = sessionCookieWrite("fam.secret", false);
if (!written.includes("myledja_rt=fam.secret")) throw new Error("writes token");
if (!written.includes("Max-Age=7776000")) throw new Error("90 day cookie");
if (!written.includes("SameSite=Lax")) throw new Error("lax cookie");
if (written.includes("Secure")) throw new Error("http cookie is not Secure");
if (!sessionCookieWrite("x", true).includes("Secure")) throw new Error("https cookie is Secure");
if (!sessionCookieClear().includes("Max-Age=0")) throw new Error("clear expires now");

console.log("session-cookies: persist refresh on the page origin");
