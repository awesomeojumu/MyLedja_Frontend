import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Banner, Button, CategoryIcon, EmptyState, Txt, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { CategoryList } from "../components/CategoryList";
import { CatScreen } from "../components/CatScreen";
import { categoryById } from "../dummy-data";

export function CategoryScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = categoryById(String(id ?? ""));
  if (!row) {
    return (
      <CatScreen title="Category" emptyTitle="This category is not on this workspace">
        <EmptyState title="This category is not on this workspace" icon="inbox" action={{ label: "See categories", onPress: () => router.replace("/(tabs)/transactions/categories") }} />
      </CatScreen>
    );
  }
  return (
    <CatScreen
      title={row.name}
      emptyTitle="No records in this category"
      errorTitle="Could not load this category"
      footer={
        <Button fullWidth onPress={() => router.push(`/(tabs)/transactions/edit-category?id=${row.id}`)}>
          Edit category
        </Button>
      }
    >
      <WidePane tablet sidebar={<CategoryList selectedId={row.id} />}>
        <View style={{ alignItems: "center", gap: t.space.space3 }}>
          <CategoryIcon category={row.name} size="lg" />
          <Txt variant="titleMd">{row.name}</Txt>
        </View>
        <Banner tone="primary" title={`${row.count} dummy records`}>
          {row.kind === "income" ? "Money in." : "Money out."} Nothing is saved to a server yet.
        </Banner>
      </WidePane>
    </CatScreen>
  );
}
