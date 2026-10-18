import { homePendingModel } from "@/features/dashboard/services/home-pending";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const model = homePendingModel({
  sessionOffline: true,
  queued: [{ operationId: "op-1", payload: { description: "Market", amount: "1500.00" } }],
  postedSpent: "4000.00",
});
assert(model.offline === true, "offline banner after a device save");
assert(model.pendingRows.length === 1, "queued row shows in Recent");
assert(model.postedSpent === "4000.00", "official Spent stays the posted total");
assert(model.waitingLine?.includes("1,500.00") === true, "pending line is separate from Spent");

console.log("home-pending: banner and waiting line, Spent unchanged");
