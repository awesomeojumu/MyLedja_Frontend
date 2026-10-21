import { useCallback, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button, Icon, Sheet, Txt, cleanAmount, compactNaira, formatMoney, useTheme } from "@/design";
import { coverSources, moveMoney, toLines, type Line } from "@/features/budgets/services/month-lines";
import { nairaAmount } from "@/lib/money-map";
import { useActiveWorkspace } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

export interface MonthView {
  month: string;
  today: number;
  daysInMonth: number;
  lines: Line[];
  /** Money not planned to any category yet (safe to spend minus the spending plan). */
  unplanned: number;
}

const EMPTY: MonthView | null = null;

/** A month's spending lines and pace inputs, cached per month. */
export function useMonthLines(month: string) {
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();
  const load = useCallback(
    async (ws: string): Promise<MonthView | null> => {
      const v = (await session.getMonthBudget(ws, month)).data as {
        month: string;
        today?: number;
        daysInMonth?: number;
        free?: string;
        spending?: { lines?: { categoryId: string; name: string; planned: string; spent: string }[] };
      };
      return { month: v.month, today: v.today ?? 0, daysInMonth: v.daysInMonth ?? 30, lines: toLines(v.spending?.lines), unplanned: Math.max(0, nairaAmount(v.free)) };
    },
    [session, month],
  );
  return useLiveQuery(load, EMPTY, workspaceId ? `month-lines-${month}` : undefined);
}

export function whole(n: number): string {
  return `${n < 0 ? "−" : ""}${formatMoney(Math.abs(Math.round(n))).replace(/\.00$/, "")}`;
}

/** Save a whole month's plan from planned amounts. */
export async function savePlan(
  session: ReturnType<typeof useSession>["session"],
  workspaceId: string,
  month: string,
  plan: { categoryId: string; planned: number }[],
) {
  await session.setMonthLines(
    workspaceId,
    month,
    plan.filter((l) => l.planned > 0).map((l) => ({ categoryId: l.categoryId, amount: l.planned.toFixed(2) })),
  );
}

/**
 * Move money into one category's plan from another with room left, or from money not planned yet.
 * `need` is what's missing (the overspend), used as the starting amount.
 */
export function CoverSheet({
  open,
  view,
  target,
  need,
  onClose,
  onDone,
}: {
  open: boolean;
  view: MonthView | null;
  target: { categoryId: string; name: string } | null;
  need: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTheme();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();
  const sources = view && target ? coverSources(view.lines, target.categoryId, view.unplanned) : [];
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [typed, setTyped] = useState(need > 0 ? String(Math.round(need)) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = sources.find((s) => s.id === sourceId) ?? sources[0];
  const amount = Number(cleanAmount(typed) || 0);
  const capped = source ? Math.min(amount, source.available) : 0;
  const targetLine = view?.lines.find((l) => l.categoryId === target?.categoryId);

  const move = async () => {
    if (!workspaceId || !view || !target || !source || capped <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const plan = moveMoney(view.lines.map((l) => ({ categoryId: l.categoryId, planned: l.planned })), target.categoryId, source.id, capped, source.available);
      await savePlan(session, workspaceId, view.month, plan);
      onDone(`Moved ${whole(capped)} to ${target.name}`);
    } catch {
      setError("Couldn't move the money. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={target ? `Cover ${target.name}` : "Move money"}
      open={open}
      onClose={onClose}
      footer={
        <Button fullWidth loading={busy} disabled={!source || capped <= 0} onPress={() => void move()}>
          {capped > 0 ? `Move ${whole(capped)}` : "Choose an amount"}
        </Button>
      }
    >
      {sources.length === 0 ? (
        <Txt variant="body" color={t.c.inkMuted}>{"No category has room left and nothing is unplanned this month. Change the plan in Create budget instead."}</Txt>
      ) : (
        <View style={{ gap: t.space.space4 }}>
          <Txt variant="bodySm" color={t.c.inkMuted}>{need > 0 ? `Move ${whole(need)} from somewhere with room left.` : "Choose where the money comes from."}</Txt>
          <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
            {sources.map((s, i) => {
              const on = s.id === source?.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSourceId(s.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${s.name}, ${whole(s.available)} ${s.id === "unplanned" ? "unplanned" : "left"}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, minHeight: 50, paddingHorizontal: t.space.space4, borderBottomWidth: i === sources.length - 1 ? 0 : 1, borderBottomColor: t.c.border, backgroundColor: on ? t.c.primarySoft : "transparent" }}
                >
                  {on ? (
                    <Icon name="circle-check" size={18} color={t.c.primary} />
                  ) : (
                    <View style={{ width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: t.c.borderStrong }} />
                  )}
                  <Txt variant="body" color={on ? t.c.onPrimarySoft : t.c.ink} style={{ flex: 1, fontWeight: on ? "600" : "400" }}>{s.name}</Txt>
                  <Txt variant="caption" color={t.c.inkMuted}>{`${compactNaira(Math.round(s.available))} ${s.id === "unplanned" ? "free" : "left"}`}</Txt>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 54, paddingHorizontal: t.space.space4, borderRadius: t.radius.radiusMd, borderWidth: 1.5, borderColor: t.c.primary }}>
            <Txt variant="amountLg" color={t.c.inkMuted}>₦</Txt>
            <TextInput
              value={typed}
              onChangeText={(v) => setTyped(cleanAmount(v))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.c.inkMuted}
              accessibilityLabel="Amount to move"
              style={[t.text("amountLg"), { flex: 1, color: t.c.ink, paddingVertical: 0, minWidth: 0 }]}
            />
          </View>
          {source && amount > source.available ? (
            <Txt variant="caption" color={t.c.warning}>{`${source.name} only has ${whole(source.available)}; that's what will move.`}</Txt>
          ) : null}
          {source && targetLine && capped > 0 ? (
            <Txt variant="caption" color={t.c.inkMuted}>
              {source.id === "unplanned"
                ? `${target?.name} goes from ${compactNaira(targetLine.planned)} to ${compactNaira(targetLine.planned + capped)}.`
                : `${source.name} goes from ${compactNaira(view!.lines.find((l) => l.categoryId === source.id)!.planned)} to ${compactNaira(view!.lines.find((l) => l.categoryId === source.id)!.planned - capped)} · ${target?.name} from ${compactNaira(targetLine.planned)} to ${compactNaira(targetLine.planned + capped)}.`}
            </Txt>
          ) : null}
          {error ? <Txt variant="caption" color={t.c.danger}>{error}</Txt> : null}
        </View>
      )}
    </Sheet>
  );
}
