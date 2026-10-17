import { cacheKey, dashboardBounds, putSnapshot, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";
import type { SessionCore } from "@/lib/session-core";

let warmed = false;

export function isWarmed(): boolean {
  return warmed;
}

export function resetWarmup(): void {
  warmed = false;
}

export async function warmupSession(session: SessionCore, workspaceId?: string, userId?: string): Promise<void> {
  if (warmed) return;
  const jobs: Promise<unknown>[] = [];
  if (userId) {
    jobs.push(
      import("@/sync/user-outbox")
        .then(({ primeUserOutbox }) => primeUserOutbox(userId))
        .catch(() => undefined),
    );
  }
  if (workspaceId) {
    const range = dashboardBounds("month");
    jobs.push(
      session
        .dashboard(workspaceId, range.from, range.to)
        .then((res) => {
          putSnapshot(cacheKey(workspaceId, range.from, range.to), res.data as unknown as DashboardSnapshot);
        })
        .catch(() => undefined),
    );
    jobs.push(session.listAccounts(workspaceId).catch(() => undefined));
    jobs.push(session.listTransactions(workspaceId).catch(() => undefined));
  }
  await Promise.all(jobs);
  warmed = true;
}
