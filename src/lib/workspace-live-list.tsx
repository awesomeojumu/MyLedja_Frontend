import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Txt, useTheme } from "@/design";
import { onMoneyWrite } from "@/lib/after-money";
import { useSession } from "@/state";

type Row = { id: string; name?: string; description?: string };

function asRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data;
  }
  return [];
}

export function WorkspaceLiveList({
  load,
  empty,
}: {
  load: (workspaceId: string) => Promise<Row[]>;
  empty: string;
}) {
  const t = useTheme();
  const { status, workspaces } = useSession();
  const [rows, setRows] = useState<Row[]>([]);

  const refresh = useCallback(() => {
    if (status !== "signedIn" || !workspaces[0]) {
      setRows([]);
      return;
    }
    const workspaceId = workspaces[0].id;
    void load(workspaceId)
      .then((next) => setRows(Array.isArray(next) ? next : (asRows(next) as Row[])))
      .catch(() => setRows([]));
  }, [load, status, workspaces]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return onMoneyWrite(() => {
        refresh();
      });
    }, [refresh]),
  );

  if (rows.length === 0) {
    return (
      <Txt variant="body" color={t.c.inkMuted}>
        {empty}
      </Txt>
    );
  }
  return (
    <View style={{ gap: t.space.space2 }}>
      {rows.map((row) => (
        <Txt key={row.id} variant="body">
          {row.name ?? row.description ?? row.id}
        </Txt>
      ))}
    </View>
  );
}
