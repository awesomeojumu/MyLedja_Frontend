/**
 * Bill reminders as local notifications (MYL-016 timing, MYL-023 privacy). Pure: no Expo or React here, so the rule
 * "hidden means no amount anywhere in the notification" is tested directly.
 */
import { formatMoney } from "@/design/format";

export interface ReminderBill {
  id: string;
  name?: string;
  amount?: string | null;
  nextDue?: string | null;
}

export interface ReminderContent {
  title: string;
  body: string;
}

export interface ReminderRequest {
  id: string;
  at: Date;
  content: ReminderContent;
  data: { kind: "bill"; billId: string };
}

/** Lock-screen copy for one bill. When amounts are hidden, nothing that looks like money or a figure goes out. */
export function billReminderContent(bill: ReminderBill, hideAmounts: boolean): ReminderContent {
  const name = (bill.name ?? "").trim() || "A bill";
  if (hideAmounts) {
    return { title: "Bill due tomorrow", body: `${name} is due tomorrow. Open MyLedja to see the amount.` };
  }
  const n = Number.parseFloat(String(bill.amount ?? ""));
  const amount = Number.isFinite(n) ? ` · ${formatMoney(n)}` : "";
  return { title: `${name} is due tomorrow`, body: `Due tomorrow${amount}.` };
}

/** True when the text could reveal an amount: a currency sign or any digit. Bill names with digits are hidden too. */
export function revealsAmount(content: ReminderContent): boolean {
  return /[₦$£€]|\d/.test(`${content.title} ${content.body}`);
}

/** 09:00 local time the day before the due date, or null when that moment has already passed. */
export function reminderTime(nextDue: string, now: Date): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextDue);
  if (!m) return null;
  const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1, 9, 0, 0, 0);
  return at.getTime() > now.getTime() ? at : null;
}

/** Every reminder to schedule now. Bills without a due date, or whose reminder time has passed, are skipped. */
export function planBillReminders(bills: readonly ReminderBill[], hideAmounts: boolean, now: Date): ReminderRequest[] {
  const out: ReminderRequest[] = [];
  for (const bill of bills) {
    if (!bill.id || !bill.nextDue) continue;
    const at = reminderTime(bill.nextDue, now);
    if (!at) continue;
    let content = billReminderContent(bill, hideAmounts);
    // A name like "Rent 2026" would still leak a figure; fall back to fully generic copy.
    if (hideAmounts && revealsAmount(content)) content = { title: "Bill due tomorrow", body: "Open MyLedja to see which bill and how much." };
    out.push({ id: `bill:${bill.id}:${bill.nextDue}`, at, content, data: { kind: "bill", billId: bill.id } });
  }
  return out;
}
