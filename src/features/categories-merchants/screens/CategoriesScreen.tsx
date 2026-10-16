import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { CategoryIcon, Txt, useTheme } from "../../../design";
import { CatScreen } from "../components/CatScreen";
import { CATEGORY_ROWS } from "../dummy-data";

export function CategoriesScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <CatScreen
      title="Categories"
      showBack
      demo
      actions={[
        { icon: "plus", label: "Add category", onPress: () => router.push("/(tabs)/transactions/add-category") },
        { icon: "users", label: "Merchants", onPress: () => router.push("/(tabs)/transactions/merchants") },
      ]}
      emptyTitle="No categories yet"
      emptyBody="Add Food, Transport, or a name you use."
      emptyAction={{ label: "Add category", icon: "plus", onPress: () => router.push("/(tabs)/transactions/add-category") }}
      errorTitle="Could not load categories"
    >
      <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
        {CATEGORY_ROWS.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/(tabs)/transactions/category?id=${row.id}`)}
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
            <CategoryIcon category={row.name} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="titleSm">{row.name}</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>
                {row.kind === "income" ? "Income" : "Expense"} · {row.count} records
              </Txt>
            </View>
          </Pressable>
        ))}
      </View>
    </CatScreen>
  );
}
