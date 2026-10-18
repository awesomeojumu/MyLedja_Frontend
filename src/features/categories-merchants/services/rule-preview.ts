/** Pure helpers for the rule preview screen. No UI or network here. */

export type RuleMode = "description" | "merchant";

export interface PreviewTxn {
  id: string;
  description?: string;
  amount?: string;
  type?: string;
  accountId?: string;
  occurredAt?: string;
}

/** The body for POST /rules/preview, or null when there is not enough to match on yet. */
export function previewBody(mode: RuleMode, text: string, merchantId: string | null): Record<string, string> | null {
  if (mode === "merchant") return merchantId ? { merchantId } : null;
  const needle = text.trim();
  return needle.length >= 2 ? { descriptionContains: needle } : null;
}

/** Exactly the transactions the API matched, in its order. IDs the list doesn't know are still counted, never dropped. */
export function previewRows(ids: readonly string[], txns: readonly PreviewTxn[]): { rows: PreviewTxn[]; unknown: number } {
  const byId = new Map(txns.map((row) => [row.id, row]));
  const rows: PreviewTxn[] = [];
  let unknown = 0;
  for (const id of ids) {
    const row = byId.get(id);
    if (row) rows.push(row);
    else unknown += 1;
  }
  return { rows, unknown };
}

export function previewHeadline(count: number): string {
  if (count === 0) return "No posted transactions match";
  return count === 1 ? "1 posted transaction matches" : `${count} posted transactions match`;
}
