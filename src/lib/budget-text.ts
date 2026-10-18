import { formatMoney } from "@/design/format";

/** "2500.00" from the API → "₦2,500.00". Anything unparseable shows a dash, never ₦0.00. */
export function nairaText(value?: string | null): string {
  if (value == null) return "—";
  const n = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? formatMoney(n, "NGN", { sign: n < 0 ? "minus" : null }) : "—";
}

/** "27500.00" → "₦27,500.00 left"; a negative remainder reads "Over by ₦…". */
export function remainingText(value?: string | null): string {
  const n = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return "—";
  return n < 0 ? `Over by ${formatMoney(-n)}` : `${formatMoney(n)} left`;
}
