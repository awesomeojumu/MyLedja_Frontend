import { readScoped, writeScoped } from "@/lib/cached-fetch";

export const ACCOUNT_OPTIONS_NAME = "account-options";

export type AccountOption = { id: string; name: string };

export function toAccountOptions(rows: unknown): AccountOption[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => row as { id?: string; name?: string })
    .filter((row) => row.id)
    .map((row) => ({ id: String(row.id), name: String(row.name ?? "Account") }));
}

export function rememberAccountOptions(userId: string, workspaceId: string, rows: unknown): AccountOption[] {
  const options = toAccountOptions(rows);
  writeScoped(userId, workspaceId, ACCOUNT_OPTIONS_NAME, options);
  return options;
}

export function readAccountOptions(userId: string, workspaceId: string): AccountOption[] | null {
  return readScoped<AccountOption[]>(userId, workspaceId, ACCOUNT_OPTIONS_NAME);
}

export type AccountGate =
  | { ok: true; accountId: string }
  | { ok: false; reason: "empty" | "loading" };

/** Use a chosen id, then a cached list. A successful empty list is empty; a miss is still loading. */
export function accountForSave(
  chosenId: string | undefined,
  options: AccountOption[] | null,
  knownEmpty: boolean,
): AccountGate {
  if (chosenId) return { ok: true, accountId: chosenId };
  const first = options?.[0]?.id;
  if (first) return { ok: true, accountId: first };
  if (knownEmpty) return { ok: false, reason: "empty" };
  return { ok: false, reason: "loading" };
}

export function accountGateMessage(reason: "empty" | "loading"): string {
  return reason === "empty" ? "Add an account first." : "Your accounts haven't loaded yet. Try again in a moment.";
}
