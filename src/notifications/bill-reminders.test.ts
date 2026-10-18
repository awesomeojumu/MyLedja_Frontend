import { billReminderContent, planBillReminders, reminderTime, revealsAmount } from "@/notifications/bill-reminders";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const dstv = { id: "b1", name: "DSTV", amount: "5000.00", nextDue: "2026-10-20" };
const now = new Date(2026, 9, 18, 12, 0, 0);

const hidden = billReminderContent(dstv, true);
assert(!revealsAmount(hidden), "hidden copy has no ₦ and no digits");
assert(hidden.body.includes("DSTV"), "hidden copy still names the bill");

const shown = billReminderContent(dstv, false);
assert(shown.body.includes("₦5,000.00"), "shown copy carries the formatted amount");

const at = reminderTime("2026-10-20", now);
assert(at != null && at.getDate() === 19 && at.getHours() === 9, "09:00 the day before");
assert(reminderTime("2026-10-18", now) === null, "a reminder time in the past is skipped");
assert(reminderTime("not-a-date", now) === null, "bad dates are skipped");

const plan = planBillReminders([dstv, { id: "b2", name: "Rent 2026", amount: "250000.00", nextDue: "2026-10-25" }, { id: "b3", name: "No date" }], true, now);
assert(plan.length === 2, "bills without a due date are skipped");
assert(plan.every((request) => !revealsAmount(request.content)), "no hidden reminder leaks a figure, even from the bill name");
assert(plan[0].id === "bill:b1:2026-10-20", "stable id per bill and due date");

const open = planBillReminders([dstv], false, now);
assert(revealsAmount(open[0].content), "with hiding off, the amount is shown");

console.log("bill-reminders: lock-screen copy never shows amounts when hidden");
