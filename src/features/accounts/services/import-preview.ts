export type ImportLine = { row: number; description?: string; narration?: string; reason?: string };

export type ImportPreview = {
  importId: string;
  accountId?: string;
  accepted: ImportLine[];
  rejected: ImportLine[];
};

let last: ImportPreview | null = null;

export function rememberImportPreview(next: ImportPreview): ImportPreview {
  last = next;
  return next;
}

export function lastImportPreview(): ImportPreview | null {
  return last;
}
