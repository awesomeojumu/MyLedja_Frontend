import { useCallback, useState } from "react";
import { View } from "react-native";
import { EmptyState, Txt, useTheme } from "@/design";
import { SCREEN_TITLES } from "@/lib/screen-catalog";
import { PlanCreateForm } from "@/lib/plan-create-form";
import { PlanLiveList } from "@/lib/plan-live-list";
import { PlanBudgetViews, type BudgetViewsData } from "@/lib/plan-budget-views";
import { planScreenSpec } from "@/lib/plan-screen-role";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

export function FeatureScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  const spec = planScreenSpec(id, title);
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">{title}</Txt>
      {spec ? <PlanRoleBody spec={spec} title={title} /> : <Txt variant="body">Ready.</Txt>}
    </View>
  );
}

function PlanRoleBody({ spec, title }: { spec: NonNullable<ReturnType<typeof planScreenSpec>>; title: string }) {
  const { session } = useSession();
  const [tick, setTick] = useState(0);
  const loadViews = useCallback(
    async (workspaceId: string) => {
      const list = await session.listCollection(workspaceId, spec.path);
      const rows = Array.isArray(list.data) ? list.data : [];
      const first = rows[0] as { id?: string } | undefined;
      if (!first?.id || spec.path !== "budgets") return null;
      const views = await session.budgetViews(workspaceId, String(first.id));
      return views.data as BudgetViewsData;
    },
    [session, spec.path],
  );
  const viewsQuery = useLiveQuery(loadViews, null, `plan-views:${spec.path}:${title}`);

  if (spec.role === "create" || spec.role === "edit" || spec.role === "action") {
    return (
      <PlanCreateForm
        path={spec.path}
        fields={spec.path === "budgets" ? [{ key: "amount", label: "Monthly amount", value: "1000.00" }] : [{ key: "name", label: "Name", value: title }, { key: "amount", label: "Amount", value: "1000.00" }]}
        extra={spec.path === "budgets" ? { primaryPeriod: "month" } : undefined}
        pickAccount={spec.path === "budgets"}
        onSaved={() => setTick((n) => n + 1)}
      />
    );
  }

  const list = <PlanLiveList path={spec.path} empty={spec.empty} refreshToken={tick} />;
  if (spec.role === "list") return list;

  return (
    <View style={{ gap: 16 }}>
      {list}
      {spec.path === "budgets" ? (
        viewsQuery.loading && !viewsQuery.data ? (
          <DefaultLoading />
        ) : (
          <>
            <LiveNotice offline={viewsQuery.offline} error={viewsQuery.error} hasData={viewsQuery.known} onRetry={viewsQuery.refresh} />
            <PlanBudgetViews data={viewsQuery.data} />
          </>
        )
      ) : null}
    </View>
  );
}

export function GatedScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">{title}</Txt>
      <EmptyState title="Not available yet" icon="ban">
        Savings, investments, and tax filing are not available yet.
      </EmptyState>
    </View>
  );
}
