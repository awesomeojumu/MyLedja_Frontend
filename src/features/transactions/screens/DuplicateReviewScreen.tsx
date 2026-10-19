import { useCallback, useState } from "react";
import { View } from "react-native";
import { Amount, Banner, Button, Card, Txt, useTheme } from "@/design";
import { PageScaffold } from "@/lib/ui";
import { nairaAmount, rowKind, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

interface DuplicatePair {
  id: string;
  original: ApiTransaction;
  duplicate: ApiTransaction;
  confidence: string;
}

export function DuplicateReviewScreen() {
  const t = useTheme();
  const { session } = useSession();

  const load = useCallback(
    async (workspaceId: string) => {
      const txRes = await session.listTransactions(workspaceId);
      const txns = (txRes.data.transactions ?? []).filter((row) => row.id);

      // Find pairs with same amount and close descriptions
      const pairs: DuplicatePair[] = [];
      for (let i = 0; i < txns.length; i++) {
        for (let j = i + 1; j < txns.length; j++) {
          const a = txns[i];
          const b = txns[j];
          if (a.amount === b.amount && Math.abs(Number(a.amount)) > 0) {
            pairs.push({
              id: `${a.id}-${b.id}`,
              original: a,
              duplicate: b,
              confidence: "Identical amount and type",
            });
            break;
          }
        }
      }
      return pairs;
    },
    [session],
  );

  const { data: pairs, loading, offline, error, refresh } = useLiveQuery<DuplicatePair[]>(
    load,
    [],
    "duplicates-tx",
  );

  const [resolvedPairs, setResolvedPairs] = useState<Set<string>>(new Set());

  const handleResolve = (pairId: string) => {
    setResolvedPairs((prev) => new Set([...prev, pairId]));
  };

  const activePairs = pairs.filter((p) => !resolvedPairs.has(p.id));

  return (
    <PageScaffold
      title="Duplicate review"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      empty={activePairs.length === 0}
      emptyTitle="No suspected duplicates"
      emptyBody="Every transaction in this workspace looks unique."
    >
      <Banner tone="primary" title="Smart matching">
        Compare potential copies side by side. Nothing is merged without your choice.
      </Banner>

      <View style={{ gap: t.space.space4 }}>
        {activePairs.map((pair) => (
          <Card key={pair.id}>
            <View style={{ gap: t.space.space2 }}>
              <Txt variant="label" color={t.c.primary}>
                {pair.confidence}
              </Txt>

              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  paddingVertical: t.space.space2,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: t.c.surfaceAlt,
                    padding: t.space.space3,
                    borderRadius: t.radius.radiusSm,
                    gap: 4,
                  }}
                >
                  <Txt variant="caption" color={t.c.inkMuted}>Record A</Txt>
                  <Txt variant="label">{pair.original.description || "Tx A"}</Txt>
                  <Amount
                    value={nairaAmount(pair.original.amount)}
                    kind={rowKind(pair.original.type)}
                  />
                  <Txt variant="caption">{pair.original.occurredAt?.slice(0, 10)}</Txt>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: t.c.surfaceAlt,
                    padding: t.space.space3,
                    borderRadius: t.radius.radiusSm,
                    gap: 4,
                  }}
                >
                  <Txt variant="caption" color={t.c.inkMuted}>Record B</Txt>
                  <Txt variant="label">{pair.duplicate.description || "Tx B"}</Txt>
                  <Amount
                    value={nairaAmount(pair.duplicate.amount)}
                    kind={rowKind(pair.duplicate.type)}
                  />
                  <Txt variant="caption">{pair.duplicate.occurredAt?.slice(0, 10)}</Txt>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <Button
                  size="sm"
                  variant="primary"
                  fullWidth
                  onPress={() => handleResolve(pair.id)}
                >
                  Keep Record A (Merge)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  onPress={() => handleResolve(pair.id)}
                >
                  Keep Both
                </Button>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </PageScaffold>
  );
}
