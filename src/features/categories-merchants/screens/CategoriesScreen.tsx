import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, EmptyState, Txt, useTheme } from "@/design";
import { ScreenShell } from "@/lib/screen-shell";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NONE: { id: string; name: string; kind: string }[] = [];

export function CategoriesScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    const res = await session.listCategories(workspaceId);
    return res.data ?? [];
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
            <Pressable key={row.id} onPress={() => router.push(`/(tabs)/transactions/category?id=${row.id}`)}>
              <Txt variant="body">{row.name}</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>{row.kind}</Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}
