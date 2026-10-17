import { CatScreen } from "@/features/categories-merchants/components/CatScreen";
import { CategoryList } from "@/features/categories-merchants/components/CategoryList";

export const EditCategoryScreen = AddCategoryScreen;

export function AddCategoryScreen() {
  return (
    <CatScreen title="Add category" showBack>
      <CategoryList />
    </CatScreen>
  );
}
