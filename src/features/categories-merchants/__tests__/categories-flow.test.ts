import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const files: [string, string[]][] = [
  ["src/features/categories-merchants/screens/CategoriesScreen.tsx", ["listCategories", "add-category", "category?id="]],
  ["src/features/categories-merchants/screens/CategoryScreen.tsx", ["getCategory", "planned", "Edit category", "Open plan", "periodFrom"]],
  ["src/features/categories-merchants/screens/AddCategoryScreen.tsx", ["createCategory", "Save category", "getCategory", "patchCategory", "Save changes", "parentId", "kind"]],
  ["src/features/categories-merchants/screens/MerchantsScreen.tsx", ["listMerchants", "createMerchant", "Select"]],
  ["src/features/categories-merchants/screens/MerchantScreen.tsx", ["getMerchant", "patchMerchant", "Rule preview", "Select"]],
];

for (const [rel, needles] of files) {
  const path = join(root, rel);
  assert(existsSync(path), `missing ${rel}`);
  const src = readFileSync(path, "utf8");
  assert(!src.includes("CategoryList"), `${rel} must not clone CategoryList`);
  for (const needle of needles) assert(src.includes(needle), `${rel} must include ${needle}`);
}

console.log("categories-flow: 042-047 wired");
