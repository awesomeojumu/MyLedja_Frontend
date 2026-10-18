import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, ChipGroup, EmptyState, SegmentedControl, TextField, TransactionRow, Txt, useTheme } from "@/design";
import { ApiError } from "@/api/client";
import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import {
  previewBody,
  previewHeadline,
  previewRows,
  type PreviewTxn,
  type RuleMode,
} from "@/features/categories-merchants/services/rule-preview";
import { LiveNotice } from "@/lib/live-notice";
import { nairaAmount, rowKind } from "@/lib/money-map";
import { useSession } from "@/state";

const MODES = [
  { value: "description", label: "Description" },
  { value: "merchant", label: "Merchant" },
];

type Result = { ids: string[]; rows: PreviewTxn[]; unknown: number };

/** MYL-011: shows exactly which posted transactions a rule would touch, before anything changes. */
export function RulePreviewScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, status, workspaces } = useSession();
  const workspaceId = workspaces[0]?.id;
  const [mode, setMode] = useState<RuleMode>("description");
  const [text, setText] = useState("");
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (status !== "signedIn" || !workspaceId) return;
    void session
      .listMerchants(workspaceId)
      .then((res) => setMerchants(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMerchants([]));
  }, [session, status, workspaceId]);

  const body = previewBody(mode, text, merchantId);

  const run = () => {
    if (!workspaceId || !body) return;
    setBusy(true);
    setError(null);
    setOffline(false);
    void Promise.all([session.previewRule(workspaceId, body), session.listTransactions(workspaceId)])
      .then(([preview, list]) => {
        const ids = preview.data.transactionIds ?? [];
        const txns = (list.data.transactions ?? []) as PreviewTxn[];
        setResult({ ids, ...previewRows(ids, txns) });
      })
      .catch((caught: unknown) => {
        setResult(null);
        if (caught instanceof ApiError && caught.status === 0) setOffline(true);
        else setError(caught instanceof Error && caught.message ? caught.message : "Couldn’t run the preview. Try again.");
      })
      .finally(() => setBusy(false));
  };

  const clear = () => setResult(null);

  return (
    <CatScreen
      title="Rule preview"
      emptyTitle="Nothing to preview"
      footer={
        <Button fullWidth size="lg" icon="list-filter" loading={busy} disabled={!body || busy} onPress={run}>
          Preview matches
        </Button>
      }
    >
      <Txt color={t.c.inkMuted}>
        See exactly which posted transactions a rule would match. Nothing changes until you choose to.
      </Txt>
      <SegmentedControl
        label="Match on"
        options={MODES}
        value={mode}
        onChange={(next) => {
          setMode(next as RuleMode);
          clear();
        }}
      />
      {mode === "description" ? (
        <TextField
          label="Description contains"
          placeholder="e.g. uber"
          autoCapitalize="none"
          returnKeyType="search"
          helper="At least 2 letters. Case and spacing are ignored."
          value={text}
          onChangeText={(next) => {
            setText(next);
            clear();
          }}
        />
      ) : merchants.length > 0 ? (
        <ChipGroup
          label="Merchant"
          scroll
          options={merchants.map((row) => ({ value: row.id, label: row.name }))}
          value={merchantId ?? ""}
          onChange={(next: string) => {
            setMerchantId(next);
            clear();
          }}
        />
      ) : (
        <EmptyState
          title="No merchants yet"
          icon="inbox"
          action={{ label: "Add a merchant", onPress: () => router.push("/(tabs)/transactions/merchants") }}
        >
          Match on description instead, or add a merchant first.
        </EmptyState>
      )}
      <LiveNotice offline={offline} error={error} hasData={false} onRetry={run} />
      {result ? (
        <View style={{ gap: t.space.space3 }} accessibilityLiveRegion="polite">
          <Txt variant="titleSm" accessibilityRole="header">
            {previewHeadline(result.ids.length)}
          </Txt>
          {result.rows.length > 0 ? (
            <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong, backgroundColor: t.c.surface }}>
              {result.rows.map((row) => (
                <TransactionRow
                  key={row.id}
                  title={row.description || "Transaction"}
                  category={row.type}
                  amount={nairaAmount(row.amount)}
                  kind={rowKind(row.type)}
                  onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
                />
              ))}
            </View>
          ) : null}
          {result.unknown > 0 ? (
            <Txt variant="caption" color={t.c.inkMuted}>
              {result.unknown === 1 ? "1 more match isn’t" : `${result.unknown} more matches aren’t`} loaded on this phone yet.
            </Txt>
          ) : null}
        </View>
      ) : null}
    </CatScreen>
  );
}
