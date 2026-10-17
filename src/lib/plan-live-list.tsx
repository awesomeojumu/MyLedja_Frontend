import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Amount, EmptyState, Sheet, Txt, useTheme } from "@/design";
import { planMoney, planName } from "@/lib/money-map";
import { useSession } from "@/state";

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
  const { session, status, workspaces } = useSession();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (status !== "signedIn" || !workspaces[0]) return;
    void session
      .listCollection(workspaces[0].id, path)
      .then((res) => {
        const data = res.data;
        setRows(Array.isArray(data) ? (data as Record<string, unknown>[]) : []);
      })
      .catch(() => setRows([]));
  }, [path, refreshToken, session, status, workspaces]);

  if (rows.length === 0) {
    return (
      <EmptyState title={empty} icon="inbox">
        Add one from the form.
      </EmptyState>
    );
  }

  const money = open ? planMoney(open) : 0;
  const facts = open
    ? (
        [
          ["Amount", money ? `₦${money.toFixed(2)}` : undefined],
          ["Account", open.accountId != null ? String(open.accountId) : undefined],
          ["Cadence", open.cadence != null ? String(open.cadence) : undefined],
          ["Due", open.dueOn != null ? String(open.dueOn) : open.nextDue != null ? String(open.nextDue) : undefined],
        ] as [string, string | undefined][]
      ).filter(([, value]) => value)
    : [];

  return (
    <View style={{ gap: t.space.space2 }}>
      {rows.map((row, index) => (
        <Pressable
          key={String(row.id ?? index)}
          onPress={() => setOpen(row)}
          accessibilityRole="button"
          accessibilityLabel={planName(row)}
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
            {planName(row)}
          </Txt>
          <Amount value={planMoney(row)} kind="neutral" />
        </Pressable>
      ))}
      <Sheet title={open ? planName(open) : "Plan"} open={open != null} onClose={() => setOpen(null)}>
        {open ? (
          <View style={{ gap: 12 }}>
            <Amount value={money} size="lg" />
            {facts.map(([label, value]) => (
              <View key={label} style={{ gap: 2 }}>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {label}
                </Txt>
                <Txt variant="body">{value}</Txt>
              </View>
            ))}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
