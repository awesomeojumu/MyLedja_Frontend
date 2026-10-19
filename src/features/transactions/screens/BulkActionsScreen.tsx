import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Amount,
  Button,
  CategoryPicker,
  Dialog,
  Icon,
  TextField,
  Txt,
  useTheme,
} from "@/design";
import { PageScaffold } from "@/lib/ui";
import { nairaAmount, rowKind, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";

export function BulkActionsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();

  const load = useCallback(
    async (workspaceId: string) => {
      const [txRes, catRes] = await Promise.all([
        session.listTransactions(workspaceId),
        session.listCategories(workspaceId),
      ]);
      const txns = (txRes.data.transactions ?? []).filter((row) => row.id);
      const categories = (catRes.data ?? []).map((c) => c.name);
      return { txns, categories };
    },
    [session],
  );

  const { data, loading, offline, error, refresh } = useLiveQuery(
    load,
    { txns: [] as ApiTransaction[], categories: [] as string[] },
    "bulk-tx",
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetCategory, setTargetCategory] = useState("Food & groceries");
  const [targetTag, setTargetTag] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, setActionType] = useState<"categorize" | "tag" | "archive">("categorize");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === data.txns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.txns.map((x) => x.id)));
    }
  };

  const { run } = useSubmit();

  const handleApply = () => {
    setConfirmOpen(false);
    run(async () => {
      // In a real execution, we call the batch API
      router.back();
    });
  };

  return (
    <PageScaffold
      title="Bulk actions"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      footer={
        selectedIds.size > 0 ? (
          <View style={{ gap: t.space.space2 }}>
            <Button
              fullWidth
              onPress={() => {
                setActionType("categorize");
                setConfirmOpen(true);
              }}
            >
              Update category for {selectedIds.size} records
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onPress={() => {
                setActionType("tag");
                setConfirmOpen(true);
              }}
            >
              Add tag to {selectedIds.size} records
            </Button>
          </View>
        ) : undefined
      }
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: t.space.space2,
        }}
      >
        <Txt variant="label">
          {selectedIds.size} selected of {data.txns.length}
        </Txt>
        <Button variant="tertiary" size="sm" onPress={selectAll}>
          {selectedIds.size === data.txns.length ? "Deselect all" : "Select all"}
        </Button>
      </View>

      {selectedIds.size > 0 ? (
        <View
          style={{
            backgroundColor: t.c.surfaceAlt,
            padding: t.space.space3,
            borderRadius: t.radius.radiusMd,
            gap: t.space.space2,
          }}
        >
          <CategoryPicker
            label="Target category"
            value={targetCategory}
            categories={data.categories.length ? data.categories : undefined}
            onChange={setTargetCategory}
          />
          <TextField
            label="Tag to apply"
            value={targetTag}
            onChangeText={setTargetTag}
            placeholder="e.g. project-alpha"
          />
        </View>
      ) : null}

      <View style={{ gap: t.space.space2 }}>
        {data.txns.map((tx) => {
          const isSelected = selectedIds.has(tx.id);
          return (
            <Pressable
              key={tx.id}
              onPress={() => toggleSelect(tx.id)}
              style={{
                padding: t.space.space3,
                backgroundColor: t.c.surface,
                borderRadius: t.radius.radiusMd,
                borderWidth: 1,
                borderColor: isSelected ? t.c.primary : t.c.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: isSelected ? t.c.primary : t.c.inkMuted,
                  backgroundColor: isSelected ? t.c.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected ? <Icon name="check" size={14} color={t.c.surface} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="label">{tx.description || "Transaction"}</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {tx.type}
                </Txt>
              </View>
              <Amount value={nairaAmount(tx.amount)} kind={rowKind(tx.type)} />
            </Pressable>
          );
        })}
      </View>

      <Dialog
        title="Confirm bulk change"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        confirmLabel="Apply changes"
        onConfirm={handleApply}
      >
        <Txt>
          This will apply to {selectedIds.size} selected transaction
          {selectedIds.size > 1 ? "s" : ""}. You can undo this action shortly
          after applying.
        </Txt>
      </Dialog>
    </PageScaffold>
  );
}
