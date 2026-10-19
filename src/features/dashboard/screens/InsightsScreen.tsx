import { useCallback } from "react";
import { useRouter } from "expo-router";
import { Amount, Banner, Button, EmptyState, Txt } from "@/design";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Budget = {
  id: string;
  planned?: string;
  onHand?: string;
  expected?: string;
  gap?: string;
  spent?: string;
};

export function InsightsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const add = () => router.push("/(tabs)/plan/budget-add");
  const load = useCallback(async (workspaceId: string) => {
    const list = await session.listBudgets(workspaceId);
    const first = (list.data ?? [])[0] as { id?: string } | undefined;
    if (!first?.id) return null;
    return (await session.getBudget(workspaceId, first.id)).data as Budget;
  }, [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, null, "insights-budget");
  const gap = nairaAmount(data?.gap);

  return (
    <ScreenShell title="Insights">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !known ? <DefaultLoading /> : null}
      {known && !data ? (
        <EmptyState title="No budget yet" action={{ label: "Add a budget", onPress: add }}>
          Plan the month before you spend it.
        </EmptyState>
      ) : data ? (
        <>
          <Txt>Planned</Txt>
          <Amount value={nairaAmount(data.planned)} />
          <Txt>On hand</Txt>
          <Amount value={nairaAmount(data.onHand)} />
          <Txt>Expected</Txt>
          <Amount value={nairaAmount(data.expected)} />
          <Txt>Spent</Txt>
          <Amount value={nairaAmount(data.spent)} />
          {gap > 0 ? <Banner tone="warning" title="Funding gap">{data.gap}</Banner> : null}
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-insights?id=${data.id}`)}>
            Open budget
          </Button>
        </>
      ) : null}
    </ScreenShell>
  );
}
