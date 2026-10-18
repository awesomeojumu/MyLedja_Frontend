export interface NamedSession {
  id: string;
  deviceLabel?: string;
  createdAt?: string;
  current?: boolean;
}

export function sessionLine(row: NamedSession): string {
  const label = row.deviceLabel?.trim();
  if (label) return `${label} · ${row.current ? "now" : "signed in"}`;
  return "1 sessions";
}

export function showSessionCount(rows: NamedSession[]): boolean {
  return rows.every((row) => !row.deviceLabel);
}
