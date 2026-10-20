import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, EmptyState, Txt, useTheme } from "@/design";
import { nairaAmount } from "@/lib/money-map";
import { ScreenShell } from "@/lib/screen-shell";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

interface CatRow {
  id: string;
  name: string;
  kind: string;
  monthlyBudget?: string | null;
}

const NONE: CatRow[] = [];

export function CategoriesScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    const res = await session.listCategories(workspaceId);
    return (res.data ?? []) as CatRow[];
  }, [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "categories");
  const add = () => router.push("/(tabs)/transactions/add-category");

  return (
    <ScreenShell title="Categories" footer={<Button fullWidth onPress={add}>Add category</Button>}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : data.length === 0 ? (
        <EmptyState title="No categories yet" action={{ label: "Add category", onPress: add }}>
          Add a category you use.
        </EmptyState>
      ) : (
        <View style={{ gap: t.space.space2 }}>
          {data.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/(tabs)/transactions/category?id=${row.id}`)}
              style={{
                backgroundColor: t.c.surface,
                borderRadius: t.radius.radiusMd,
                borderWidth: 1,
                borderColor: t.c.border,
                padding: t.space.space3,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ gap: 2 }}>
                <Txt variant="body" color={t.c.ink} style={{ fontWeight: "600" }}>{row.name}</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {row.kind}
                  {row.monthlyBudget ? ` · ₦${nairaAmount(row.monthlyBudget).toLocaleString()}/month` : " · Reusable monthly"}
                </Txt>
              </View>
              {row.monthlyBudget ? (
                <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "600" }}>
                  ₦{nairaAmount(row.monthlyBudget).toLocaleString()}
                </Txt>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}
