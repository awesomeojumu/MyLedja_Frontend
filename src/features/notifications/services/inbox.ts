import { formatDateDMY, formatMoney } from "@/design/format";
import { remainingText } from "@/lib/budget-text";
import { revealsAmount } from "@/notifications/bill-reminders";
import { type ReminderPrefs } from "@/features/notifications/services/prefs";

export type NoticeKind = "bill" | "budget" | "summary";

export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  when: string;
  href: string;
};

export type InboxBill = {
  id: string;
  name?: string;
  amount?: string | null;
  nextDue?: string | null;
};

export type InboxBudget = {
  id: string;
  name?: string;
  planned?: string | null;
  remaining?: string | null;
  overspent?: boolean;
};

const HIDDEN_BILL = {
  title: "Bill due soon",
  body: "Open MyLedja to see which bill and how much.",
};

const HIDDEN_BUDGET = {
  title: "A budget needs a look",
  body: "Open MyLedja to see how much is left.",
};

function parseMoney(value?: string | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function daysUntil(nextDue: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextDue);
  if (!match) return null;
  const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function weekKey(now: Date): string {
  const start = new Date(now.getFullYear(), 0, 1);
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return `${now.getFullYear()}-w${Math.floor(day / 7)}`;
}

function billNotice(bill: InboxBill, hideAmounts: boolean, now: Date): Notice | null {
  if (!bill.id || !bill.nextDue) return null;
  const days = daysUntil(bill.nextDue, now);
  if (days == null || days < 0 || days > 14) return null;
  const when = formatDateDMY(bill.nextDue) || "Soon";
  const name = (bill.name ?? "").trim() || "A bill";
  let copy = hideAmounts
    ? { title: "Bill due soon", body: `${name} is coming up. Open MyLedja to see the amount.` }
    : (() => {
        const amount = parseMoney(bill.amount);
        const money = amount == null ? "" : ` · ${formatMoney(amount)}`;
        return { title: `${name} is due soon`, body: `Due ${when}${money}.` };
      })();
  if (hideAmounts && revealsAmount(copy)) copy = HIDDEN_BILL;
  return {
    id: `bill:${bill.id}:${bill.nextDue}`,
    kind: "bill",
    title: copy.title,
    body: copy.body,
    when: hideAmounts ? "Coming up" : when,
    href: `/(tabs)/plan/bill-detail?id=${bill.id}`,
  };
}

function needsBudgetLook(budget: InboxBudget): boolean {
  if (budget.overspent) return true;
  const remaining = parseMoney(budget.remaining);
  if (remaining != null && remaining < 0) return true;
  const planned = parseMoney(budget.planned);
  if (remaining == null || planned == null || planned <= 0) return false;
  return remaining / planned <= 0.2;
}

function budgetNotice(budget: InboxBudget, hideAmounts: boolean): Notice | null {
  if (!budget.id || !needsBudgetLook(budget)) return null;
  const name = (budget.name ?? "").trim() || "A budget";
  const over = budget.overspent === true || (parseMoney(budget.remaining) ?? 0) < 0;
  let copy = hideAmounts
    ? HIDDEN_BUDGET
    : {
        title: over ? `${name} is over` : `${name} is nearly used`,
        body: remainingText(budget.remaining),
      };
  if (!hideAmounts && copy.body === "—") {
    copy = { title: copy.title, body: "Open the budget to see what is left." };
  }
  if (hideAmounts && revealsAmount(copy)) copy = HIDDEN_BUDGET;
  return {
    id: `budget:${budget.id}`,
    kind: "budget",
    title: copy.title,
    body: copy.body,
    when: "This period",
    href: `/(tabs)/plan/budget-detail?id=${budget.id}`,
  };
}

function summaryNotice(now: Date): Notice {
  return {
    id: `summary:${weekKey(now)}`,
    kind: "summary",
    title: "Weekly summary",
    body: "Sunday evening, what came in and went out.",
    when: "This week",
    href: "/(tabs)",
  };
}

/** In-app alerts for the next 14 days. Hidden mode never includes a figure or a currency sign. */
export function buildInbox(input: {
  bills: readonly InboxBill[];
  budgets: readonly InboxBudget[];
  prefs: ReminderPrefs;
  hideAmounts: boolean;
  now: Date;
}): Notice[] {
  const bills = input.prefs.bills
    ? input.bills.flatMap((bill) => {
        const notice = billNotice(bill, input.hideAmounts, input.now);
        return notice ? [notice] : [];
      })
    : [];
  const budgets = input.prefs.budget
    ? input.budgets.flatMap((budget) => {
        const notice = budgetNotice(budget, input.hideAmounts);
        return notice ? [notice] : [];
      })
    : [];
  const summary = input.prefs.summary ? [summaryNotice(input.now)] : [];
  return [...bills, ...budgets, ...summary];
}

export function findNotice(items: readonly Notice[], id: string | undefined): Notice | null {
  if (!id) return null;
  return items.find((item) => item.id === id) ?? null;
}
