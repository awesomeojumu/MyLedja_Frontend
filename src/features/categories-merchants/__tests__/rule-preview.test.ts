import { previewBody, previewHeadline, previewRows } from "@/features/categories-merchants/services/rule-preview";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(previewBody("description", " a ", null) === null, "one letter is not enough to match");
assert(JSON.stringify(previewBody("description", " uber ", null)) === JSON.stringify({ descriptionContains: "uber" }), "trimmed text match");
assert(previewBody("merchant", "", null) === null, "merchant mode needs a merchant");
assert(JSON.stringify(previewBody("merchant", "ignored", "m1")) === JSON.stringify({ merchantId: "m1" }), "merchant match");

const txns = [
  { id: "t1", description: "Uber trip" },
  { id: "t2", description: "Lunch" },
  { id: "t3", description: "Uber eats" },
];
const { rows, unknown } = previewRows(["t3", "t1", "t9"], txns);
assert(rows.map((row) => row.id).join(",") === "t3,t1", "exactly the matched rows, in API order");
assert(unknown === 1, "an ID the list doesn't know is counted, not dropped");
assert(!rows.some((row) => row.id === "t2"), "an unmatched row never appears");

assert(previewHeadline(0) === "No posted transactions match", "empty headline");
assert(previewHeadline(1) === "1 posted transaction matches", "singular");
assert(previewHeadline(3) === "3 posted transactions match", "plural");

console.log("rule-preview: exact matches only");
