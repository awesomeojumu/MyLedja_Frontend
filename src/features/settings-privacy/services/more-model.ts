import { nairaAmount, type ApiAccount } from "@/lib/money-map";

/** Words for a 0–100 health score, so the number never stands alone. */
export function healthLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs work";
}

/** Money in savings accounts that aren't archived. */
export function savingsTotal(accounts: ApiAccount[]): { total: number; count: number } {
  const rows = accounts.filter((a) => !a.archived && a.kind === "savings");
  return { total: rows.reduce((sum, a) => sum + nairaAmount(a.balance), 0), count: rows.length };
}

export interface HoldingRow {
  value?: string | null;
  capital?: string | null;
  cost?: string | null;
}

/** What holdings are worth now, and the gain against what went in (null when nothing is held). */
export function holdingsValue(rows: HoldingRow[]): { value: number; gainPct: number | null; count: number } {
  let value = 0;
  let cost = 0;
  for (const h of rows) {
    value += nairaAmount(h.value ?? h.capital);
    cost += nairaAmount(h.capital ?? h.cost);
  }
  return { value, gainPct: rows.length && cost > 0 ? ((value - cost) / cost) * 100 : null, count: rows.length };
}

/** Alerts worth a badge: bills and budgets. The weekly summary is a digest, not an alert. */
export function alertCount(notices: { kind?: string }[]): number {
  return notices.filter((n) => n.kind !== "summary").length;
}

/** "Ayo Bami" from "ayo.bami@x.com"; falls back to the address. */
export function displayName(email?: string | null): string {
  const local = (email ?? "").split("@")[0];
  const words = local.split(/[._-]+/).filter((w) => /[a-z]/i.test(w));
  if (!words.length) return email || "Your account";
  return words.slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
