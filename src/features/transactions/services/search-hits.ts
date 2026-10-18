export type SearchKind = "transaction" | "account" | "bill" | "goal" | "debt";

export interface SearchHit {
  id: string;
  label: string;
  kind: SearchKind;
  type?: string;
  amount?: string;
}

type SearchRow = { id: string; label: string; type?: string; amount?: string; kind?: string; accountKind?: string };

export interface SearchPayload {
  transactions?: SearchRow[];
  accounts?: SearchRow[];
  bills?: SearchRow[];
  goals?: SearchRow[];
  debts?: SearchRow[];
}

const GROUPS: SearchKind[] = ["transaction", "account", "bill", "goal", "debt"];

export function flattenSearch(data: SearchPayload | null | undefined): SearchHit[] {
  if (!data) return [];
  const rows: SearchHit[] = [];
  const push = (kind: SearchKind, list?: SearchRow[]) => {
    for (const row of list ?? []) {
      rows.push({ id: row.id, label: row.label, kind, type: row.type, amount: row.amount });
    }
  };
  push("transaction", data.transactions);
  push(
    "account",
    (data.accounts ?? []).filter((row) => {
      const shadow = row.accountKind ?? row.kind;
      return shadow !== "liability" && shadow !== "receivable";
    }),
  );
  push("bill", data.bills);
  push("goal", data.goals);
  push("debt", data.debts);
  return rows;
}

export function searchGroups(hits: SearchHit[]): { kind: SearchKind; rows: SearchHit[] }[] {
  return GROUPS.map((kind) => ({ kind, rows: hits.filter((row) => row.kind === kind) })).filter((group) => group.rows.length > 0);
}

export function searchHref(hit: SearchHit): string {
  if (hit.kind === "account") return `/(tabs)/accounts/${hit.id}`;
  if (hit.kind === "bill") return `/(tabs)/plan/bills`;
  if (hit.kind === "goal") return `/(tabs)/plan/goals`;
  if (hit.kind === "debt") return `/(tabs)/plan/debts`;
  return `/(tabs)/transactions/${hit.id}`;
}
