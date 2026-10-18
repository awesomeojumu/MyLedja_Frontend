import type { IconName } from "@/design";
import type { AccountGroup, AccountKind, LedgerAccount } from "@/features/accounts/types/account";

export type RowKind = "expense" | "income" | "transfer";

export interface ApiAccount {
  id?: string;
  name?: string;
  kind?: string;
  institution?: string | null;
  institutionId?: string | null;
  connectionType?: "manual" | "linked" | "imported";
  currency?: string;
  balance?: string;
  opening?: string;
  mask?: string | null;
  archived?: boolean;
  externalBalance?: string | null;
  reconciledAsOf?: string | null;
}

export interface ApiTransaction {
  id: string;
  type?: string;
  status?: string;
  description?: string;
  amount?: string;
  accountId?: string;
  toAccountId?: string | null;
  categoryId?: string | null;
}

export function parseNaira(value?: string | number | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[₦,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function nairaAmount(value?: string | number | null): number {
  return parseNaira(value) ?? 0;
}

export function rowKind(type?: string): RowKind {
  if (type === "income" || type === "refund" || type === "loan_in" || type === "principal_collect") return "income";
  if (type === "transfer") return "transfer";
  return "expense";
}

export function toLedgerAccount(row: ApiAccount): LedgerAccount {
  const kind = (["bank", "wallet", "cash", "savings", "liability"].includes(String(row.kind))
    ? row.kind
    : "cash") as AccountKind;
  const group: AccountGroup = kind === "liability" ? "liability" : kind === "savings" ? "savings" : "cash-and-bank";
  const icon: IconName = kind === "liability" ? "landmark" : "wallet";
  const institution = row.institution ?? "";
  const mask = row.mask ? `•••• ${row.mask}` : undefined;
  const connection = row.connectionType ?? "manual";
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Account"),
    kind,
    institution,
    connectionType: connection,
    currency: "NGN",
    balance: nairaAmount(row.balance),
    opening: nairaAmount(row.opening),
    lastFour: row.mask ?? undefined,
    reconciled: Boolean(row.reconciledAsOf),
    lastActivity: row.reconciledAsOf ?? "",
    externalBalance: row.externalBalance ?? null,
    reconciledAsOf: row.reconciledAsOf ?? null,
    icon,
    group,
    statusLine: [institution, mask, connection, kind].filter(Boolean).join(" · ") || kind,
    archived: row.archived,
  };
}

/** The row's amount, or null when the server sent none, so lists can show "—" instead of a misleading ₦0. */
export function planMoneyOrNull(row: Record<string, unknown>): number | null {
  const raw = row.amount ?? row.target ?? row.principal ?? row.expected ?? row.balance;
  if (raw == null || raw === "") return null;
  return nairaAmount(raw as string | number);
}

export function planMoney(row: Record<string, unknown>): number {
  return nairaAmount(
    (row.amount ?? row.target ?? row.principal ?? row.expected ?? row.balance) as string | number | undefined,
  );
}

const PERIOD_WORD: Record<string, string> = { day: "daily", week: "weekly", month: "monthly", year: "annual" };

/**
 * A readable label for any plan row. Never a raw ID: a budget has no name of its own, so it reads as its account and
 * period ("GTBank Salary · monthly budget").
 */
export function planName(row: Record<string, unknown>, accountNames: Record<string, string> = {}): string {
  const own = row.name ?? row.counterparty;
  if (typeof own === "string" && own.trim()) return own.trim();
  if (row.primaryPeriod != null || (row.accountId != null && row.amount != null && row.cadence == null)) {
    const account = accountNames[String(row.accountId ?? "")] ?? "Account";
    const period = PERIOD_WORD[String(row.primaryPeriod ?? "month")] ?? "monthly";
    return `${account} · ${period} budget`;
  }
  return "Untitled";
}
