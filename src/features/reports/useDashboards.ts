import { useCallback, useMemo } from 'react';

import type { ReportCardModel, ReportDashboardModel } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';

import { defaultDashboards, relayout } from './helpers';

/**
 * The workspace's report dashboards. Until someone changes one, the two starting dashboards are shown
 * without being saved, so a device and the server never both create them; the first change saves them.
 * Their ids are fixed so a card's link works before then.
 */
export function useDashboards() {
  const { snapshot, repo } = useWorkspace();
  const saved = snapshot?.reportDashboards;
  const dashboards: ReportDashboardModel[] = useMemo(() => {
    if (saved?.length) return saved;
    let n = 0;
    return defaultDashboards(() => `default-${n++}`).map((d, i) => ({ ...d, id: `default-dashboard-${i}` }));
  }, [saved]);
  const virtual = !saved?.length;

  /** Saves a dashboard's cards (and name), saving the starting dashboards first if they aren't yet. */
  const save = useCallback(
    async (dashboardId: string, change: { cards?: ReportCardModel[]; name?: string }): Promise<string> => {
      const target = dashboards.find((d) => d.id === dashboardId);
      if (!target) return dashboardId;
      const next = { ...target, ...change, cards: change.cards ? relayout(change.cards) : target.cards };
      if (!virtual) {
        await repo.saveDashboard(next);
        return next.id;
      }
      let id = dashboardId;
      for (const d of dashboards) {
        const made = await repo.createDashboard(d.id === dashboardId ? next.name : d.name, d.id === dashboardId ? next.cards : d.cards);
        if (d.id === dashboardId) id = made.id;
      }
      return id;
    },
    [dashboards, virtual, repo],
  );

  const create = useCallback(
    async (name: string, cards: ReportCardModel[] = []): Promise<string> => {
      if (virtual) for (const d of dashboards) await repo.createDashboard(d.name, d.cards);
      return (await repo.createDashboard(name, cards)).id;
    },
    [dashboards, virtual, repo],
  );

  const remove = useCallback(
    async (dashboardId: string) => {
      if (virtual) {
        for (const d of dashboards) if (d.id !== dashboardId) await repo.createDashboard(d.name, d.cards);
        return;
      }
      await repo.deleteDashboard(dashboardId);
    },
    [dashboards, virtual, repo],
  );

  /** Finds a card on any dashboard. */
  const cardById = useCallback(
    (cardId: string) => {
      for (const d of dashboards) {
        const card = d.cards.find((c) => c.id === cardId);
        if (card) return { dashboard: d, card };
      }
      return null;
    },
    [dashboards],
  );

  return { dashboards, ready: !!snapshot, save, create, remove, cardById };
}
