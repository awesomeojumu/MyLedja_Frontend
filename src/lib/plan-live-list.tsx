import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Amount, EmptyState, formatDateDMY, Sheet, Txt, useTheme } from "@/design";
import { LiveNotice } from "@/lib/live-notice";
import { planMoneyOrNull, planName } from "@/lib/money-map";
import { PlanBudgetViews, type BudgetViewsData } from "@/lib/plan-budget-views";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type PlanRows = { rows: Record<string, unknown>[]; accountNames: Record<string, string> };
const NONE: PlanRows = { rows: [], accountNames: {} };

/**
 * A live plan list (budgets, bills, goals, income streams, debts). It shows a skeleton while loading, the last saved
 * rows with an offline note when the server can't be reached, an error with a retry, and "No … yet" only when the
 * server has said the list is empty.
 */
export function PlanLiveList({
  path,
  empty,
  refreshToken = 0,
}: {
  path: string;
  empty: string;
  refreshToken?: number;
}) {
  const t = useTheme();
  const { session, workspaces } = useSession();
  const workspaceId = workspaces[0]?.id;
  const [open, setOpen] = useState<Record<string, unknown> | null>(null);
  const [views, setViews] = useState<BudgetViewsData | null>(null);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const [viewsOffline, setViewsOffline] = useState(false);

  const load = useCallback(
    async (workspaceId: string): Promise<PlanRows> => {
      const [res, accountsRes] = await Promise.all([
        session.listCollection(workspaceId, path),
        path === "budgets" ? session.listAccounts(workspaceId) : Promise.resolve(null),
      ]);
      const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
      const accounts = accountsRes && Array.isArray(accountsRes.data) ? (accountsRes.data as { id?: string; name?: string }[]) : [];
      const accountNames = Object.fromEntries(accounts.filter((row) => row.id).map((row) => [String(row.id), String(row.name ?? "Account")]));
      return { rows, accountNames };
    },
    [path, session],
  );
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, `plan:${path}`);
  const { rows, accountNames } = data;

  const lastToken = useRef(refreshToken);
  useEffect(() => {
    if (lastToken.current === refreshToken) return;
    lastToken.current = refreshToken;
    refresh();
  }, [refresh, refreshToken]);

  useEffect(() => {
    if (path !== "budgets" || !open?.id || !workspaceId) return;
    let cancelled = false;
    void session
      .budgetViews(workspaceId, String(open.id))
      .then((res) => {
        if (cancelled) return;
        setViews(res.data as BudgetViewsData);
        setViewsError(null);
        setViewsOffline(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        const status = caught && typeof caught === "object" && "status" in caught ? Number((caught as { status: number }).status) : -1;
        setViewsOffline(status === 0);
        setViewsError(caught instanceof Error ? caught.message : "Could not load views");
      });
    return () => {
      cancelled = true;
    };
  }, [open, path, session, workspaceId]);

  const notice = <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />;

  if (loading && rows.length === 0) {
    return (
      <View style={{ gap: t.space.space3 }}>
        {notice}
        <DefaultLoading />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={{ gap: t.space.space3 }}>
        {notice}
        {known ? (
          <EmptyState title={empty} icon="inbox">
            Add one from the form.
          </EmptyState>
        ) : null}
      </View>
    );
  }

  const money = open ? planMoneyOrNull(open) : null;
  const facts = open
    ? (
        [
          ["Amount", money != null ? `₦${money.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined],
          ["Account", open.accountId != null ? accountNames[String(open.accountId)] ?? "Account" : undefined],
          ["Cadence", open.cadence != null ? String(open.cadence) : undefined],
          ["Due", open.dueOn != null ? formatDateDMY(String(open.dueOn)) || String(open.dueOn) : open.nextDue != null ? formatDateDMY(String(open.nextDue)) || String(open.nextDue) : undefined],
        ] as [string, string | undefined][]
      ).filter(([, value]) => value)
    : [];

  return (
    <View style={{ gap: t.space.space2 }}>
      {notice}
      {rows.map((row, index) => (
        <Pressable
          key={String(row.id ?? index)}
          onPress={() => setOpen(row)}
          accessibilityRole="button"
          accessibilityLabel={planName(row, accountNames)}
          accessibilityHint="Opens the details"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 14,
            borderRadius: t.radius.radiusLg,
            backgroundColor: t.c.surface,
            borderWidth: 1,
            borderColor: t.c.borderStrong,
          }}
        >
          <Txt variant="titleSm" style={{ flex: 1, fontWeight: "500" }}>
            {planName(row, accountNames)}
          </Txt>
          {planMoneyOrNull(row) != null ? (
            <Amount value={planMoneyOrNull(row) ?? 0} kind="neutral" />
          ) : (
            <Txt variant="body" color={t.c.inkMuted} accessibilityLabel="No amount">
              —
            </Txt>
          )}
        </Pressable>
      ))}
      <Sheet title={open ? planName(open, accountNames) : "Plan"} open={open != null} onClose={() => setOpen(null)}>
        {open ? (
          <View style={{ gap: 12 }}>
            {money != null ? <Amount value={money} size="lg" /> : null}
            {facts.map(([label, value]) => (
              <View key={label} style={{ gap: 2 }}>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {label}
                </Txt>
                <Txt variant="body">{value}</Txt>
              </View>
            ))}
            {path === "budgets" ? (
              <View style={{ gap: 8 }}>
                <LiveNotice offline={viewsOffline} error={viewsError} hasData={views != null} onRetry={() => setOpen({ ...open })} />
                <PlanBudgetViews data={views} />
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
