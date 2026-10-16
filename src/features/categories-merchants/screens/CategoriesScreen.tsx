import { useRouter } from "expo-router";
import { Banner } from "../../../design";
import { WidePane } from "../../../lib";
import { CategoryList } from "../components/CategoryList";
import { CatScreen } from "../components/CatScreen";
import { CATEGORY_ROWS } from "../dummy-data";

export function CategoriesScreen() {
  const router = useRouter();
  const first = CATEGORY_ROWS[0];
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
      <WidePane tablet sidebar={<CategoryList selectedId={first?.id} />}>
        {first ? (
          <Banner tone="primary" title={first.name}>
            {first.count} dummy records. Open a row for the full category.
          </Banner>
        ) : null}
      </WidePane>
    </CatScreen>
  );
}
