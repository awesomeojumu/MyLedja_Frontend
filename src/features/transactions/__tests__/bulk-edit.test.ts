import {
  activeFilterCount,
  applyBulk,
  bulkMessage,
  correctedCopy,
  matchesFilters,
  NO_FILTERS,
  skipReason,
  unchanged,
  voidBulk,
  withDate,
} from "@/features/transactions/services/bulk-edit";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const when = new Date(2026, 9, 18, 22, 51).toISOString();
const food = { id: "1", type: "expense", amount: "1000.00", accountId: "gt", categoryId: "c-food", description: "Lunch", occurredAt: when };
const move = { id: "2", type: "transfer", amount: "500.00", accountId: "gt", toAccountId: "cash", description: "To cash", occurredAt: when };

const moved = new Date(withDate(when, "2026-10-12"));
assert(moved.getDate() === 12 && moved.getHours() === 22 && moved.getMinutes() === 51, "date changes, time of day stays");

const copy = correctedCopy(food, { categoryId: "c-tr" }, "op-1");
assert(copy.categoryId === "c-tr" && copy.accountId === "gt" && copy.occurredAt === when && copy.amount === "1000.00", "copy keeps every other field");
assert(copy.description === "Lunch" && copy.operationId === "op-1" && copy.status === "posted", "copy is posted with a fresh operation id");
assert(correctedCopy(move, { accountId: "opay" }, "op-2").toAccountId === "cash", "transfer keeps its destination");

assert(skipReason(move, { categoryId: "c-tr" }) !== null, "transfers skip category changes");
assert(skipReason(move, { accountId: "cash" }) !== null, "a transfer can't come from its own destination");
assert(skipReason(food, { accountId: "cash" }) === null, "expense can move account");
assert(unchanged(food, { categoryId: "c-food" }) && !unchanged(food, { categoryId: "c-tr" }), "same category is a no-op");
assert(unchanged(food, { date: "2026-10-18" }) && !unchanged(food, { date: "2026-10-17" }), "same date is a no-op");

const calls: string[] = [];
let failVoidFor = "";
const session = {
  createTransaction: async (_w: string, body: unknown) => {
    calls.push(`create:${(body as { operationId: string }).operationId}`);
    return { data: { id: `new-${(body as { operationId: string }).operationId}` } };
  },
  setTransactionStatus: async (_w: string, id: string) => {
    calls.push(`void:${id}`);
    if (id === failVoidFor) throw new Error("nope");
    return {};
  },
};
let n = 0;
const ids = () => `op${++n}`;

void (async () => {
  const r = await applyBulk(session, "w", [food, move], { categoryId: "c-tr" }, ids);
  assert(r.done === 1 && r.skipped === 1 && r.failed === 0, "one changed, transfer skipped");
  assert(calls.join(",") === "create:op1,void:1", "posts the copy before voiding the original");

  calls.length = 0;
  failVoidFor = "1";
  const bad = await applyBulk(session, "w", [food], { categoryId: "c-other" }, ids);
  assert(bad.failed === 1 && bad.done === 0, "a failed void counts as failed");
  assert(calls.join(",") === "create:op2,void:1,void:new-op2", "the copy is voided again when the original can't be");

  failVoidFor = "";
  const gone = await voidBulk(session, "w", [food, move]);
  assert(gone.done === 2, "void each row");

  assert(bulkMessage("Moved", { done: 3, skipped: 1, failed: 0 }) === "Moved 3 · 1 skipped", "message with skips");

  assert(activeFilterCount(NO_FILTERS) === 0, "no filters");
  const f = { categoryIds: ["c-food"], accountIds: [], min: 500, max: null };
  assert(activeFilterCount(f) === 2, "category and amount count as two");
  assert(matchesFilters(food, f, 1000) && !matchesFilters(food, f, 400), "amount range");
  assert(!matchesFilters(move, f, 500), "category filter drops uncategorised rows");
  assert(matchesFilters(move, { ...NO_FILTERS, accountIds: ["cash"] }, 500), "account filter matches either side of a transfer");

  console.log("bulk-edit: copy, skip, apply, rollback, filters");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
