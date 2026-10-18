import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, Icon, Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { useSession } from "@/state";

export function InstitutionScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, kind, from } = useLocalSearchParams<{ id?: string; kind?: string; from?: string }>();
  const { session, workspaces } = useSession();
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) return;
    void session.listInstitutions(workspaceId).then((res) => {
      setBanks(Array.isArray(res.data) ? res.data : []);
    });
  }, [session, workspaces]);

  return (
    <AccountScreenShell title="Select financial institution" showBack>
      <View style={{ gap: t.space.space3 }}>
        {banks.length === 0 ? (
          <Txt variant="body" color={t.c.inkMuted}>
            No institutions
          </Txt>
        ) : (
          banks.map((bank) => (
            <Pressable
              key={bank.id}
              accessibilityRole="button"
              accessibilityLabel={bank.name}
              onPress={() => {
                const nextKind = kind === "wallet" ? "wallet" : "bank";
                const source = from ?? id;
                router.push(
                  `/(tabs)/accounts/add?kind=${nextKind}&institution=${bank.id}${source ? `&from=${source}` : ""}`,
                );
              }}
            >
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Txt variant="titleSm" style={{ flex: 1 }}>
                    {bank.name}
                  </Txt>
                  <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </AccountScreenShell>
  );
}
