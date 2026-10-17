import { CATEGORY_ROWS, MERCHANTS, categoryById, merchantById } from "@/features/categories-merchants/dummy-data";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(CATEGORY_ROWS.length >= 4, "At least four dummy categories");
assert(
  CATEGORY_ROWS.some((row) => row.kind === "expense"),
  "An expense category is present",
);
assert(CATEGORY_ROWS.some((row) => row.kind === "income"), "An income category is present");
assert(categoryById("food")?.name === "Food & groceries", "Food is findable");
assert(MERCHANTS.some((row) => row.name === "Shoprite"), "Shoprite is a merchant");
assert(merchantById("uber")?.category === "Transport", "Uber maps to Transport");

console.log("categories dummy data: names, kinds, merchants");
