import { revealsAmount, billReminderContent } from "@/notifications/bill-reminders";
import { lockScreenSafe } from "@/lib/lock-copy";

export type LockPreview = {
  title: string;
  body: string;
  safe: boolean;
};

const SAMPLE = { id: "preview", name: "DSTV", amount: "24500.00", nextDue: "2026-10-20" };

/** What a locked phone would show for a typical bill reminder. */
export function lockPreview(hideAmounts: boolean): LockPreview {
  const content = billReminderContent(SAMPLE, hideAmounts);
  const safe = hideAmounts ? !revealsAmount(content) && lockScreenSafe(content.title, true) && lockScreenSafe(content.body, true) : true;
  return { title: content.title, body: content.body, safe };
}
