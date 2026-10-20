import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Amount,
  AmountInput,
  Banner,
  Button,
  CategoryPicker,
  IconButton,
  Txt,
  useTheme,
} from "@/design";
import { PageScaffold } from "@/lib/ui";
import { nairaAmount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useSession } from "@/state";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { newId } from "@/lib/ids";

interface SplitLine {
  id: string;
  category: string;
  amount: string;
}

export function SplitScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();

  const load = useCallback(
    async (wsId: string) => {
      const [txRes, catRes] = await Promise.all([
        session.listTransactions(wsId),
        session.listCategories(wsId),
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
    "split-tx",
  );

  const tx = data.txns.find((item) => item.id === id);
  const totalKobo = tx?.amount ? Math.round(Number(tx.amount) * 100) : 0;

  const [lines, setLines] = useState<SplitLine[]>([
    { id: "1", category: "Food & groceries", amount: "0.00" },
    { id: "2", category: "Transport", amount: "0.00" },
  ]);

  const assignedKobo = lines.reduce((acc, line) => {
    const val = Math.round(Number(line.amount || "0") * 100);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const remainingKobo = totalKobo - assignedKobo;
  const isExactMatch = totalKobo > 0 && remainingKobo === 0;

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: String(Date.now()), category: data.categories[0] ?? "Other", amount: "0.00" },
    ]);
  };

  const removeLine = (lineId: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const updateLine = (lineId: string, patch: Partial<SplitLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    );
  };

  const fillRemaining = (lineId: string) => {
    const thisLine = lines.find((l) => l.id === lineId);
    const thisLineKobo = thisLine ? Math.round(Number(thisLine.amount || "0") * 100) : 0;
    const canFillKobo = Math.max(0, remainingKobo + (isNaN(thisLineKobo) ? 0 : thisLineKobo));
    const filledStr = (canFillKobo / 100).toFixed(2);
    updateLine(lineId, { amount: filledStr });
  };

  const { busy, error: submitError, run } = useSubmit();

  const handleSave = () => {
    if (!isExactMatch || !tx) return;
    run(async () => {
      if (workspaceId) {
        try {
          await session.setTransactionStatus(workspaceId, tx.id, "voided");
        } catch {
          // ignore
        }
        for (const line of lines) {
          await session.createTransaction(workspaceId, {
            operationId: newId(),
            type: "expense",
            amount: line.amount.includes(".") ? line.amount : `${line.amount}.00`,
            accountId: tx.accountId,
            categoryId: line.category,
            description: `${tx.description || "Split expense"} (${line.category})`,
            status: "posted",
          });
        }
      }
      router.back();
    });
  };

  return (
    <PageScaffold
      title="Split transaction"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      footer={
        <Button
          fullWidth
          disabled={!isExactMatch}
          loading={busy}
          onPress={handleSave}
        >
          {isExactMatch ? "Save split" : "Lines must equal total"}
        </Button>
      }
    >
      {submitError ? <Banner tone="danger" title={submitError} /> : null}

      {tx ? (
        <View
          style={{
            backgroundColor: t.c.surfaceAlt,
            padding: t.space.space4,
            borderRadius: t.radius.radiusMd,
            gap: 4,
          }}
        >
          <Txt variant="label" color={t.c.inkMuted}>Original transaction</Txt>
          <Txt variant="titleMd">{tx.description || "Expense"}</Txt>
          <Amount value={nairaAmount(tx.amount)} size="lg" />
        </View>
      ) : (
        <Banner tone="warning" title="No transaction selected">
          Please select a posted transaction from your feed to split.
        </Banner>
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: t.space.space2,
        }}
      >
        <View>
          <Txt variant="label">Remaining to assign</Txt>
          <Amount
            value={remainingKobo / 100}
            kind={remainingKobo === 0 ? "income" : "expense"}
          />
        </View>
        <Button variant="secondary" size="sm" icon="plus" onPress={addLine}>
          Add line
        </Button>
      </View>

      <View style={{ gap: t.space.space4 }}>
        {lines.map((line, idx) => {
          const lineValKobo = Math.round(Number(line.amount || "0") * 100);
          const availableToFill = remainingKobo + (isNaN(lineValKobo) ? 0 : lineValKobo);
          return (
            <View
              key={line.id}
              style={{
                backgroundColor: t.c.surface,
                borderWidth: 1,
                borderColor: t.c.border,
                borderRadius: t.radius.radiusMd,
                padding: t.space.space3,
                gap: t.space.space2,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Txt variant="label">Line {idx + 1}</Txt>
                {lines.length > 2 ? (
                  <IconButton
                    icon="trash-2"
                    label="Remove"
                    onPress={() => removeLine(line.id)}
                  />
                ) : null}
              </View>

              <CategoryPicker
                label="Category"
                value={line.category}
                categories={data.categories.length ? data.categories : undefined}
                onChange={(category) => updateLine(line.id, { category })}
              />

              <AmountInput
                label="Line amount"
                value={line.amount}
                onChange={(val) => updateLine(line.id, { amount: val })}
              />

              {availableToFill > 0 && Math.abs(availableToFill - lineValKobo) > 0 ? (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => fillRemaining(line.id)}
                >
                  {`Auto-fill remaining (₦${(availableToFill / 100).toFixed(2)})`}
                </Button>
              ) : null}
            </View>
          );
        })}
      </View>
    </PageScaffold>
  );
}
