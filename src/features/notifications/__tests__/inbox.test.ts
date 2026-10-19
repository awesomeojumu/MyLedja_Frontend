import { revealsAmount } from "@/notifications/bill-reminders";
import { buildInbox, findNotice } from "@/features/notifications/services/inbox";
import { DEFAULT_REMINDERS, readReminders, remindersPatch } from "@/features/notifications/services/prefs";
import { lockPreview } from "@/features/notifications/services/lock-preview";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = new Date(2026, 9, 18, 12, 0, 0);
const prefs = { bills: true, budget: true, summary: true };
const bills = [
  { id: "b1", name: "DSTV", amount: "5000.00", nextDue: "2026-10-20" },
  { id: "b2", name: "Rent 2026", amount: "250000.00", nextDue: "2026-10-25" },
  { id: "b3", name: "Far away", amount: "10.00", nextDue: "2026-12-01" },
  { id: "b4", name: "Already due", amount: "10.00", nextDue: "2026-10-01" },
];
const budgets = [
  { id: "g1", name: "Food", planned: "10000.00", remaining: "1500.00" },
  { id: "g2", name: "Transport", planned: "10000.00", remaining: "8000.00" },
  { id: "g3", name: "Data", planned: "4000.00", remaining: "-200.00", overspent: true },
];

const shown = buildInbox({ bills, budgets, prefs, hideAmounts: false, now });
assert(shown.some((item) => item.id === "bill:b1:2026-10-20"), "a bill due in two days is listed");
assert(!shown.some((item) => item.id.startsWith("bill:b3")), "a bill more than 14 days out stays off the list");
assert(!shown.some((item) => item.id.startsWith("bill:b4")), "a past due date stays off the list");
assert(shown.some((item) => item.id === "budget:g1"), "20% or less remaining is an alert");
assert(!shown.some((item) => item.id === "budget:g2"), "a healthy budget is quiet");
assert(shown.some((item) => item.id === "budget:g3" && item.title.includes("over")), "an overspent budget says so");
assert(shown.some((item) => item.kind === "summary"), "weekly summary is listed when it is on");
assert(shown.find((item) => item.id.startsWith("bill:b1"))?.body.includes("₦5,000.00"), "shown bill copy carries the amount");

const hidden = buildInbox({ bills, budgets, prefs, hideAmounts: true, now });
assert(hidden.every((item) => !revealsAmount({ title: item.title, body: item.body })), "hidden inbox has no figure");
assert(hidden.every((item) => !revealsAmount({ title: item.when, body: "" })), "hidden dates stay off the row");
assert(hidden.some((item) => item.body.includes("which bill")), "a bill name with a year does not leak");

const billsOff = buildInbox({ bills, budgets, prefs: { ...prefs, bills: false }, hideAmounts: false, now });
assert(!billsOff.some((item) => item.kind === "bill"), "bill reminders off removes bill rows");

const quiet = buildInbox({ bills, budgets, prefs: DEFAULT_REMINDERS, hideAmounts: true, now });
assert(!quiet.some((item) => item.kind === "summary"), "weekly summary stays off by default");

const hit = findNotice(shown, "budget:g1");
assert(hit?.href.includes("budget-detail"), "a budget alert opens that budget");
assert(findNotice(shown, "missing") === null, "an unknown id is not an alert");

const read = readReminders({ bills: false, budget: true, summary: true, security: true });
assert(read.bills === false && read.summary === true, "saved toggles are kept");
assert(!("security" in read), "security is not a saved toggle");
assert(readReminders(null).budget === true && readReminders(null).summary === false, "defaults match setup");

const patch = remindersPatch({ bills: false, budget: true, summary: false });
assert(patch.reminders.bills === false, "the setup patch carries the three flags");
assert(!("security" in patch.reminders), "the patch does not add a security flag");

const locked = lockPreview(true);
assert(locked.safe && !revealsAmount(locked), "lock-screen preview hides the amount");
const open = lockPreview(false);
assert(open.body.includes("₦24,500.00"), "lock-screen preview shows the amount when hiding is off");

console.log("notifications: inbox, reminder prefs, and lock-screen preview");
