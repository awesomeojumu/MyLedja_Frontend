import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import { CategoryList } from "@/features/categories-merchants/components/CategoryList";

export function CategoriesScreen() {
  return (
    <CatScreen title="Categories" showBack emptyTitle="No categories yet" emptyBody="Add a category you use.">
      <CategoryList />
    </CatScreen>
  );
}
