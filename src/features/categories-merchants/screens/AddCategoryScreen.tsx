import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Button, SegmentedControl, TextField, Toast } from "@/design";
import { WidePane } from "@/lib";
import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import { categoryById } from "@/features/categories-merchants/dummy-data";

const KINDS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export function AddCategoryScreen({ mode = "add" }: { mode?: "add" | "edit" } = {}) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = mode === "edit" ? categoryById(String(id ?? "")) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<"expense" | "income">(existing?.kind ?? "expense");
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const save = () => {
    if (!name.trim()) {
      setError("Name this category.");
      return;
    }
    setError(undefined);
    setToast(mode === "edit" ? `${name.trim()} updated.` : `${name.trim()} added.`);
  };
  return (
    <CatScreen
      title={mode === "edit" ? "Edit category" : "Add category"}
      emptyTitle="Nothing to save yet"
      errorTitle="Could not save this category"
      footer={<Button fullWidth onPress={save}>{mode === "edit" ? "Save category" : "Add category"}</Button>}
    >
      <WidePane>
        <SegmentedControl label="Type" options={KINDS} value={kind} onChange={(value) => setKind(value as "expense" | "income")} />
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Food & groceries" error={error} />
      </WidePane>
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            router.back();
          }}
        />
      ) : null}
    </CatScreen>
  );
}

export function EditCategoryScreen() {
  return <AddCategoryScreen mode="edit" />;
}
