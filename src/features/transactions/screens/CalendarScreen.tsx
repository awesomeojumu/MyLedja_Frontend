import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Amount, Txt, useTheme } from "@/design";
import { PageScaffold } from "@/lib/ui";
import { nairaAmount, rowKind, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

export function CalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();

  const load = useCallback(
    async (workspaceId: string) => {
      const txRes = await session.listTransactions(workspaceId);
      return (txRes.data.transactions ?? []).filter((row) => row.id);
    },
    [session],
  );

  const { data: txns, loading, offline, error, refresh } = useLiveQuery<ApiTransaction[]>(
    load,
    [],
    "calendar-tx",
  );

  const now = new Date();
  const [selectedDayIso, setSelectedDayIso] = useState(
    now.toISOString().slice(0, 10),
  );

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: { label: string; iso?: string }[] = Array.from(
    { length: startPad },
    () => ({ label: "" }),
  );
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ label: String(d), iso });
  }

  const byDay = new Map<string, ApiTransaction[]>();
  for (const tx of txns) {
    if (tx.status === "voided" || tx.status === "reversed") continue;
    const dateKey = tx.occurredAt ? tx.occurredAt.slice(0, 10) : "";
    if (dateKey) {
      byDay.set(dateKey, [...(byDay.get(dateKey) ?? []), tx]);
    }
  }

  const selectedTxns = selectedDayIso ? byDay.get(selectedDayIso) ?? [] : [];

  return (
    <PageScaffold
      title="Transaction calendar"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
    >
      <Txt variant="label">
        {now.toLocaleString("en-NG", { month: "long", year: "numeric" })}
      </Txt>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
        {cells.map((cell, i) => {
          const hits = cell.iso ? byDay.get(cell.iso) ?? [] : [];
          const hasIncome = hits.some((x) => x.type === "income");
          const hasExpense = hits.some((x) => x.type === "expense");
          const isSelected = cell.iso === selectedDayIso;

          return (
            <Pressable
              key={`${cell.iso ?? "pad"}-${i}`}
              style={{
                width: "14.28%",
                minHeight: 48,
                padding: 4,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: t.radius.radiusSm,
                backgroundColor: isSelected ? t.c.surfaceAlt : "transparent",
              }}
              onPress={cell.iso ? () => setSelectedDayIso(cell.iso!) : undefined}
            >
              <Txt
                variant="caption"
                style={{ fontWeight: isSelected ? "700" : "400" }}
              >
                {cell.label}
              </Txt>
              <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                {hasIncome ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: t.c.positive,
                    }}
                  />
                ) : null}
                {hasExpense ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: t.c.negative,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: t.space.space4, gap: t.space.space2 }}>
        <Txt variant="titleSm">
          Records for {selectedDayIso || "Selected day"}
        </Txt>
        {selectedTxns.length === 0 ? (
          <Txt variant="body" color={t.c.inkMuted}>
            No transactions on this date.
          </Txt>
        ) : (
          selectedTxns.map((tx) => (
            <Pressable
              key={tx.id}
              onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)}
              style={{
                padding: t.space.space3,
                backgroundColor: t.c.surface,
                borderRadius: t.radius.radiusMd,
                borderWidth: 1,
                borderColor: t.c.border,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Txt variant="label">{tx.description || "Transaction"}</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {tx.type}
                </Txt>
              </View>
              <Amount value={nairaAmount(tx.amount)} kind={rowKind(tx.type)} />
            </Pressable>
          ))
        )}
      </View>
    </PageScaffold>
  );
}
