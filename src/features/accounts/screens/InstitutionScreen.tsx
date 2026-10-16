import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Icon, Txt, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { INSTITUTIONS } from "../dummy-data";

export function InstitutionScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <AccountScreenShell title="Select financial institution" emptyTitle="No banks yet" errorTitle="Could not load institutions">
      <WidePane>
      {INSTITUTIONS.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => router.push(`/(tabs)/accounts/connection?id=${id ?? "gtbank"}&institution=${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
        >
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Txt variant="titleSm" style={{ flex: 1 }}>
                {item.name}
              </Txt>
              <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
            </View>
          </Card>
        </Pressable>
      ))}
      </WidePane>
    </AccountScreenShell>
  );
}
