/** Receipt attachments are stored as a `receipt:<url-or-id>` notes prefix (PU-01 / PU-23). */

const RECEIPT_RE = /(?:^|\n)receipt:([^\n]*)/;

export function parseReceipt(notes?: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(RECEIPT_RE);
  return m?.[1]?.trim() || null;
}

export function stripReceiptLine(notes?: string | null): string {
  if (!notes) return '';
  return notes.replace(/(?:^|\n)receipt:[^\n]*/g, '').replace(/^\n+/, '').trim();
}

export function withReceipt(notes: string | undefined, receipt: string | null): string | undefined {
  const body = stripReceiptLine(notes);
  const line = receipt?.trim() ? `receipt:${receipt.trim()}` : '';
  const combined = [line, body].filter(Boolean).join('\n');
  return combined || undefined;
}

/** Short-lived signed link: query `exp=` (unix seconds). Expired → empty for PU23-1. */
export function resolveReceiptUrl(raw: string, nowSec = Math.floor(Date.now() / 1000)): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const exp = url.searchParams.get('exp');
    if (exp && Number(exp) <= nowSec) return null;
    return trimmed;
  } catch {
    // Non-URL ids (local file keys) are treated as still valid until the viewer fetches a signed link.
    return trimmed;
  }
}
