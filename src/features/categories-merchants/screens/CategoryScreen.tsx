import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import { CategoryList } from "@/features/categories-merchants/components/CategoryList";

export function CategoryScreen() {
  return (
    <CatScreen title="Category" showBack>
      <CategoryList />
    </CatScreen>
  );
}
