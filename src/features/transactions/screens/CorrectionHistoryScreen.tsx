import { useCallback } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Card, Icon, Txt, useTheme } from "@/design";
import { PageScaffold } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";

interface AuditEntry {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  device: string;
}

export function CorrectionHistoryScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const load = useCallback(
    async (_workspaceId: string) => {
      // Mocked or loaded from endpoint
      const logs: AuditEntry[] = [
        {
          id: "log-1",
          field: "Category",
          oldValue: "Uncategorized",
          newValue: "Food & groceries",
          changedBy: "You",
          changedAt: new Date(Date.now() - 3600000).toISOString(),
          device: "Android phone",
        },
        {
          id: "log-2",
          field: "Amount",
          oldValue: "₦4,000.00",
          newValue: "₦4,500.00",
          changedBy: "You",
          changedAt: new Date(Date.now() - 86400000).toISOString(),
          device: "Web app",
        },
      ];
      return logs;
    },
    [],
  );

  const { data: logs, loading, offline, error, refresh } = useLiveQuery<AuditEntry[]>(
    load,
    [],
    id ? `tx-history-${id}` : "tx-history",
  );

  return (
    <PageScaffold
      title="Correction history"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      empty={logs.length === 0}
      emptyTitle="No modifications recorded"
      emptyBody="This record has not been altered since it was created."
    >
      <View style={{ gap: t.space.space3 }}>
        {logs.map((log) => (
          <Card key={log.id}>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="label" style={{ fontWeight: "700" }}>
                  {log.field} changed
                </Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {log.changedAt.slice(0, 10)}
                </Txt>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 }}>
                <Txt variant="bodySm" color={t.c.inkMuted} style={{ textDecorationLine: "line-through" }}>
                  {log.oldValue}
                </Txt>
                <Icon name="arrow-right" size={14} color={t.c.inkMuted} />
                <Txt variant="bodySm" style={{ fontWeight: "600", color: t.c.primary }}>
                  {log.newValue}
                </Txt>
              </View>

              <Txt variant="caption" color={t.c.inkMuted}>
                By {log.changedBy} on {log.device}
              </Txt>
            </View>
          </Card>
        ))}
      </View>
    </PageScaffold>
  );
}
