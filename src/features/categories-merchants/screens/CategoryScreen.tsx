import { useCallback } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Amount, Button, TransactionRow, Txt, useTheme } from "@/design";
import { nairaAmount } from "@/lib/money-map";
import { ScreenShell } from "@/lib/screen-shell";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

export function CategoryScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    const [cat, txns] = await Promise.all([session.getCategory(workspaceId, id), session.listTransactions(workspaceId)]);
    const from = cat.data.periodFrom ? new Date(String(cat.data.periodFrom)).getTime() : 0;
    const to = cat.data.periodTo ? new Date(String(cat.data.periodTo)).getTime() : Number.MAX_SAFE_INTEGER;
    const rows = (txns.data.transactions ?? []).filter((row) => {
      if (row.categoryId !== id || row.type === "transfer") return false;
      const at = row.occurredAt ? new Date(row.occurredAt).getTime() : Date.now();
      return at >= from && at <= to;
    });
    return { cat: cat.data, rows };
  }, [id, session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, null, id ? `category-${id}` : undefined);
  const name = String(data?.cat?.name ?? "Category");

  return (
    <ScreenShell
      title={name}
      footer={<Button fullWidth onPress={() => router.push(`/(tabs)/transactions/edit-category?id=${id}`)}>Edit category</Button>}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data?.cat ? (
        <View style={{ gap: t.space.space3 }}>
          <Amount value={nairaAmount(String(data.cat.remaining))} />
          <Txt variant="caption" color={t.c.inkMuted}>
            Planned {String(data.cat.planned)} · spent {String(data.cat.spent)}
          </Txt>
          {data.cat.budgetId ? (
            <Button
              variant="secondary"
              onPress={() => router.push(`/(tabs)/plan/budget-detail?id=${String(data.cat.budgetId)}`)}
            >
              Open plan
            </Button>
          ) : null}
          {data.rows.map((row) => (
            <TransactionRow
              key={row.id}
              title={row.description ?? "Transaction"}
              amount={nairaAmount(row.amount)}
              kind={row.type === "income" ? "income" : row.type === "transfer" ? "transfer" : "expense"}
            />
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
}
