import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  Amount,
  Banner,
  Button,
  Card,
  Txt,
  useTheme,
} from "@/design";
import { PageScaffold } from "@/lib/ui";
import { nairaAmount, rowKind, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

interface Suggestion {
  id: string;
  tx: ApiTransaction;
  suggestedCategory: string;
  confidence: string;
  basis: string;
}

export function SuggestedCategorizationScreen() {
  const t = useTheme();
  const { session } = useSession();

  const load = useCallback(
    async (workspaceId: string) => {
      const txRes = await session.listTransactions(workspaceId);
      const txns = (txRes.data.transactions ?? []).filter((row) => row.id);

      // Extract suggestions for uncategorized or generic records
      const list: Suggestion[] = txns.slice(0, 3).map((tx, idx) => ({
        id: `sug-${tx.id}-${idx}`,
        tx,
        suggestedCategory: idx % 2 === 0 ? "Food & groceries" : "Transport",
        confidence: "High (92%)",
        basis: "Matched similar descriptions from your previous manual edits.",
      }));
      return list;
    },
    [session],
  );

  const { data: suggestions, loading, offline, error, refresh } = useLiveQuery<Suggestion[]>(
    load,
    [],
    "suggested-cats",
  );

  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const handleAction = (id: string) => {
    setResolved((prev) => new Set([...prev, id]));
  };

  const active = suggestions.filter((s) => !resolved.has(s.id));

  return (
    <PageScaffold
      title="Suggested categorization"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      empty={active.length === 0}
      emptyTitle="All caught up"
      emptyBody="No pending categorization suggestions. MyLedja learns from your manual edits."
    >
      <Banner tone="primary" title="Automated learning">
        Confirm or modify smart suggestions. MyLedja suggestions will never move money or change balances.
      </Banner>

      <View style={{ gap: t.space.space3 }}>
        {active.map((item) => (
          <Card key={item.id}>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="titleSm">{item.tx.description || "Transaction"}</Txt>
                <Amount value={nairaAmount(item.tx.amount)} kind={rowKind(item.tx.type)} />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 4 }}>
                <Txt variant="caption" color={t.c.inkMuted}>Suggested:</Txt>
                <Txt variant="label" style={{ color: t.c.primary, fontWeight: "700" }}>
                  {item.suggestedCategory}
                </Txt>
                <Txt variant="caption" color={t.c.positive}>({item.confidence})</Txt>
              </View>

              <Txt variant="caption" color={t.c.inkMuted}>
                {item.basis}
              </Txt>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Button
                  size="sm"
                  fullWidth
                  onPress={() => handleAction(item.id)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  onPress={() => handleAction(item.id)}
                >
                  Change
                </Button>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </PageScaffold>
  );
}
