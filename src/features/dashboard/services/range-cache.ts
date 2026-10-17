export interface SnapshotFigure {
  value: string;
  currency: string;
  basis: string;
}

export interface DashboardSnapshot {
  income: SnapshotFigure;
  expense: SnapshotFigure;
  refund: SnapshotFigure;
  netCash: SnapshotFigure;
  netWorth: SnapshotFigure;
  budgetRemaining: SnapshotFigure;
}

const cache = new Map<string, DashboardSnapshot>();
let latest: DashboardSnapshot | undefined;

export function cacheKey(workspaceId: string, from: string, to: string): string {
  return `${workspaceId}:${from}:${to}`;
}

export function dashboardBounds(period: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const to = `${y}-${m}-${d}T23:59:59.999Z`;
  if (period === "today") {
    return { from: `${y}-${m}-${d}T00:00:00.000Z`, to };
  }
  if (period === "week") {
    const from = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate() - 6));
    return { from: from.toISOString().slice(0, 10) + "T00:00:00.000Z", to };
  }
  if (period === "year") {
    return { from: `${y}-01-01T00:00:00.000Z`, to };
  }
  return { from: `${y}-${m}-01T00:00:00.000Z`, to };
}

export function putSnapshot(key: string, snapshot: DashboardSnapshot): DashboardSnapshot {
  cache.set(key, snapshot);
  latest = snapshot;
  return snapshot;
}

export function lastSnapshot(): DashboardSnapshot | undefined {
  return latest;
}

export function getSnapshot(key: string): DashboardSnapshot | undefined {
  return cache.get(key);
}

export function clearSnapshots(): void {
  cache.clear();
  latest = undefined;
}

export function switchCachedRange(key: string): { snapshot: DashboardSnapshot; elapsedMs: number } | null {
  const start = Date.now();
  const snapshot = cache.get(key);
  if (!snapshot) return null;
  return { snapshot, elapsedMs: Date.now() - start };
}
