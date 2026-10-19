import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, EmptyState, Select, TextField, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NONE: { id: string; name: string }[] = [];

export function MerchantsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [aliases, setAliases] = useState("");
  const { busy, run } = useSubmit();
  const load = useCallback(async (workspaceId: string) => {
    const res = await session.listMerchants(workspaceId);
    return res.data ?? [];
  }, [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "merchants");
  const loadCats = useCallback(async (workspaceId: string) => (await session.listCategories(workspaceId)).data ?? [], [session]);
  const { data: categories } = useLiveQuery(loadCats, [], "merchant-cats");
  const catOptions = categories.map((row) => ({ value: row.id, label: row.name }));

  return (
    <ScreenShell
      title="Merchants"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId) return;
              await session.createMerchant(workspaceId, {
                name,
                categoryId,
                aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
              });
              refresh();
              setName("");
              setAliases("");
            })
          }
        >
          Add merchant
        </Button>
      }
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      <TextField label="Name" value={name} onChangeText={setName} />
      <Select label="Category" value={categoryId} options={catOptions} onChange={setCategoryId} />
      <TextField label="Aliases" value={aliases} onChangeText={setAliases} helper="Comma-separated names this shop posts as." />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : data.length === 0 ? (
        <EmptyState title="No merchants yet">Add a shop so spend can land on a category.</EmptyState>
      ) : (
        <View style={{ gap: t.space.space2 }}>
          {data.map((row) => (
            <Pressable key={row.id} onPress={() => router.push(`/(tabs)/transactions/merchant?id=${row.id}`)}>
              <Txt>{row.name}</Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}
