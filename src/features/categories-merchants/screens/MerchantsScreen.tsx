import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { CategoryIcon, Txt, useTheme } from "../../../design";
import { CatScreen } from "../components/CatScreen";
import { MERCHANTS } from "../dummy-data";

export function MerchantsScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <CatScreen
      title="Merchants"
      demo
      emptyTitle="No merchants yet"
      emptyBody="Names from your records will group here."
      errorTitle="Could not load merchants"
    >
      <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
        {MERCHANTS.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/(tabs)/transactions/merchant?id=${row.id}`)}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 64,
              paddingHorizontal: 16,
              backgroundColor: t.c.surface,
              borderBottomWidth: 1,
              borderBottomColor: t.c.border,
            }}
          >
            <CategoryIcon category={row.category} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="titleSm">{row.name}</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>
                {row.category} · {row.count} records
              </Txt>
            </View>
          </Pressable>
        ))}
      </View>
    </CatScreen>
  );
}
