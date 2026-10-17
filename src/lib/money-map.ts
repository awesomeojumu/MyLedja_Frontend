import type { IconName } from "@/design";
import type { AccountGroup, AccountKind, LedgerAccount } from "@/features/accounts/types/account";

export type RowKind = "expense" | "income" | "transfer";

export interface ApiAccount {
  id?: string;
  name?: string;
  kind?: string;
  institution?: string | null;
  currency?: string;
  balance?: string;
  opening?: string;
  mask?: string | null;
  archived?: boolean;
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

export function nairaAmount(value?: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
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
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Account"),
    kind,
    institution,
    currency: "NGN",
    balance: nairaAmount(row.balance),
    opening: nairaAmount(row.opening),
    lastFour: row.mask ?? undefined,
    reconciled: false,
    lastActivity: "",
    icon,
    group,
    statusLine: [institution, kind].filter(Boolean).join(" · ") || kind,
    archived: row.archived,
  };
}

export function planMoney(row: Record<string, unknown>): number {
  return nairaAmount(
    (row.amount ?? row.target ?? row.principal ?? row.expected ?? row.balance) as string | number | undefined,
  );
}

export function planName(row: Record<string, unknown>): string {
  return String(row.name ?? row.counterparty ?? row.accountId ?? row.id ?? "Plan item");
}
