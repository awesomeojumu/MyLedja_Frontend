import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Amount, Button, EmptyState, ProgressBar, Txt, useTheme } from "@/design";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Goal = { id: string; name?: string; target?: string; saved?: string; completed?: boolean };

export function GoalsPreviewScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listGoals(workspaceId)).data ?? []) as Goal[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, [], "goals-preview");
  const rows = data.filter((row) => !row.completed).slice(0, 3);

  return (
    <ScreenShell title="Goals" footer={rows.length > 0 ? <Button fullWidth variant="tertiary" onPress={() => router.push("/(tabs)/plan/goals")}>See all goals</Button> : undefined}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? <DefaultLoading /> : null}
      {known && rows.length === 0 ? (
        <EmptyState title="No goals yet" action={{ label: "Add a goal", onPress: () => router.push("/(tabs)/plan/goal-add") }} />
      ) : (
        <View style={{ gap: t.space.space4 }}>
          {rows.map((row) => {
            const saved = nairaAmount(row.saved);
            const target = nairaAmount(row.target);
            return (
              <Pressable key={row.id} onPress={() => router.push(`/(tabs)/plan/goal-detail?id=${row.id}`)}>
                <Txt variant="label">{row.name}</Txt>
                <ProgressBar label="Saved" value={saved} max={target > 0 ? target : 1} money currency="NGN" />
                <Txt>Saved</Txt>
                <Amount value={saved} />
                <Txt>Target</Txt>
                <Amount value={target} />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
}
