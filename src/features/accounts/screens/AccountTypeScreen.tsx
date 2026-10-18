import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, Icon, Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";

const KINDS = [
  { id: "cash", title: "Cash", body: "Notes and coins on you." },
  { id: "bank", title: "Bank", body: "A naira account at a bank." },
  { id: "wallet", title: "Wallet", body: "Opay, Kuda, or another wallet." },
] as const;

export function AccountTypeScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <AccountScreenShell title="Account type" showBack>
      <View style={{ gap: t.space.space3 }}>
        {KINDS.map((kind) => (
          <Pressable
            key={kind.id}
            accessibilityRole="button"
            accessibilityLabel={kind.title}
            onPress={() =>
              router.push(
                kind.id === "cash"
                  ? "/(tabs)/accounts/add?kind=cash"
                  : `/(tabs)/accounts/institution?kind=${kind.id}`,
              )
            }
          >
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="titleSm">{kind.title}</Txt>
                  <Txt variant="bodySm" color={t.c.inkMuted}>
                    {kind.body}
                  </Txt>
                </View>
                <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </AccountScreenShell>
  );
}
