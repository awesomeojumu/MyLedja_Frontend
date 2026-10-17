import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { CategoryIcon, Txt, useTheme } from "@/design";
import { CATEGORY_ROWS, type CategoryRow } from "@/features/categories-merchants/dummy-data";

export function CategoryList({ selectedId }: { selectedId?: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
      {CATEGORY_ROWS.map((row) => (
        <CategoryListRow key={row.id} row={row} selected={row.id === selectedId} onPress={() => router.push(`/(tabs)/transactions/category?id=${row.id}`)} />
      ))}
    </View>
  );
}

export function CategoryListRow({ row, selected, onPress }: { row: CategoryRow; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.name}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        backgroundColor: selected ? t.c.primarySoft : t.c.surface,
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
  );
}
