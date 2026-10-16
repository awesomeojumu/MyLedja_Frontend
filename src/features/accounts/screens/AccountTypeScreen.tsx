import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Icon, Txt, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { ACCOUNT_TYPES } from "../dummy-data";

export function AccountTypeScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <AccountScreenShell title="Account type" emptyTitle="No types yet" errorTitle="Could not load types">
      <WidePane>
      {ACCOUNT_TYPES.map((type) => (
        <Pressable
          key={type.id}
          onPress={() => router.push(`/(tabs)/accounts/add?kind=${type.id}`)}
          accessibilityRole="button"
          accessibilityLabel={type.title}
        >
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="titleSm">{type.title}</Txt>
                <Txt variant="bodySm" color={t.c.inkMuted}>
                  {type.body}
                </Txt>
              </View>
              <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
            </View>
          </Card>
        </Pressable>
      ))}
      </WidePane>
    </AccountScreenShell>
  );
}
