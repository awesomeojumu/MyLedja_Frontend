import { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, Button, SegmentedControl, Select, TextField } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { ScreenShell } from "@/lib/screen-shell";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

export function AddCategoryScreen() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("expense");
  const [parentId, setParentId] = useState("");
  const { busy, error, run } = useSubmit();
  const workspaceId = workspaces[0]?.id;
  const loadCats = useCallback(async (ws: string) => (await session.listCategories(ws)).data ?? [], [session]);
  const { data: categories } = useLiveQuery(loadCats, [], "add-cat-parents");
  const parents = categories
    .filter((row) => !row.parentId && row.kind === kind)
    .map((row) => ({ value: row.id, label: row.name }));

  return (
    <ScreenShell
      title="Add category"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              if (!workspaceId || !name.trim()) return;
              await session.createCategory(workspaceId, { name: name.trim(), kind, parentId: parentId || undefined });
              if (from === "budget") router.back();
              else router.replace("/(tabs)/transactions/categories");
            })
          }
        >
          Save category
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <TextField label="Name" value={name} onChangeText={setName} />
      <SegmentedControl label="Type" value={kind} onChange={setKind} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
      {parents.length > 0 ? (
        <Select label="Parent (optional)" value={parentId} options={[{ value: "", label: "None" }, ...parents]} onChange={setParentId} />
      ) : null}
    </ScreenShell>
  );
}

export function EditCategoryScreen() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("expense");
  const [parentId, setParentId] = useState("");
  const { busy, error, run } = useSubmit();
  const workspaceId = workspaces[0]?.id;
  const loadCats = useCallback(async (ws: string) => (await session.listCategories(ws)).data ?? [], [session]);
  const { data: categories } = useLiveQuery(loadCats, [], "edit-cat-parents");
  const parents = categories
    .filter((row) => row.id !== id && !row.parentId && row.kind === kind)
    .map((row) => ({ value: row.id, label: row.name }));
  const load = useCallback(
    async (ws: string) => {
      if (!id) return null;
      const res = await session.getCategory(ws, id);
      setName(String(res.data.name ?? ""));
      setKind(String(res.data.kind ?? "expense"));
      setParentId(res.data.parentId ? String(res.data.parentId) : "");
      return res.data;
    },
    [id, session],
  );
  useLiveQuery(load, null, id ? `edit-cat-${id}` : undefined);

  return (
    <ScreenShell
      title="Edit category"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              if (!workspaceId || !id || !name.trim()) return;
              await session.patchCategory(workspaceId, id, {
                name: name.trim(),
                kind,
                parentId: parentId || null,
              });
              router.back();
            })
          }
        >
          Save changes
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <TextField label="Name" value={name} onChangeText={setName} />
      <SegmentedControl label="Type" value={kind} onChange={setKind} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
      {parents.length > 0 ? (
        <Select label="Parent (optional)" value={parentId} options={[{ value: "", label: "None" }, ...parents]} onChange={setParentId} />
      ) : null}
    </ScreenShell>
  );
}
