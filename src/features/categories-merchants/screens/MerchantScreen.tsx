import { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, Button, Select, TextField } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

export function MerchantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [aliases, setAliases] = useState("");
  const { busy, error, run } = useSubmit();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    const res = await session.getMerchant(workspaceId, id);
    const data = res.data;
    setName(String(data.name ?? ""));
    setCategoryId(String(data.categoryId ?? ""));
    setAliases(Array.isArray(data.aliases) ? data.aliases.join(", ") : "");
    return data;
  }, [id, session]);
  const { data, loading, offline, known, refresh } = useLiveQuery(load, null, id ? `merchant-${id}` : undefined);
  const loadCats = useCallback(async (workspaceId: string) => (await session.listCategories(workspaceId)).data ?? [], [session]);
  const { data: categories } = useLiveQuery(loadCats, [], "merchant-edit-cats");
  const catOptions = categories.map((row) => ({ value: row.id, label: row.name }));

  return (
    <ScreenShell
      title={name || "Merchant"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId || !id) return;
              await session.patchMerchant(workspaceId, id, {
                name,
                categoryId,
                aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
              });
              router.back();
            })
          }
        >
          Save changes
        </Button>
      }
    >
      <LiveNotice offline={offline} error={null} hasData={known} onRetry={refresh} />
      {error ? <Banner tone="danger" title={error} /> : null}
      {loading && !data ? <DefaultLoading /> : null}
      <TextField label="Name" value={name} onChangeText={setName} />
      <Select label="Category" value={categoryId} options={catOptions} onChange={setCategoryId} />
      <TextField label="Aliases" value={aliases} onChangeText={setAliases} />
      <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/rules")}>
        Rule preview
      </Button>
    </ScreenShell>
  );
}
