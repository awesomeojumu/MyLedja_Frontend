/** What VoiceOver and TalkBack must hear on the five MYL-024 journeys. Each node is name + role + state. */
export type ReaderNode = {
  name: string;
  role: "button" | "text field" | "secure text field" | "radio" | "tab" | "header" | "alert";
  state?: "selected" | "not selected" | "busy";
};

export const READER_JOURNEYS: { id: string; title: string; nodes: ReaderNode[] }[] = [
  {
    id: "sign-in",
    title: "Sign in",
    nodes: [
      { name: "Email", role: "text field" },
      { name: "Password", role: "secure text field" },
      { name: "Sign in", role: "button" },
    ],
  },
  {
    id: "record-expense",
    title: "Record an expense",
    nodes: [
      { name: "Add transaction", role: "button" },
      { name: "Amount in naira", role: "text field" },
      { name: "Transport", role: "radio", state: "not selected" },
      { name: "Save expense", role: "button" },
      { name: "Expense saved", role: "alert" },
    ],
  },
  {
    id: "check-home",
    title: "Check Home",
    nodes: [
      { name: "Home", role: "header" },
      { name: "Balance hidden", role: "header" },
      { name: "Today", role: "radio", state: "selected" },
      { name: "Recent", role: "header" },
    ],
  },
  {
    id: "find-record",
    title: "Find a record",
    nodes: [
      { name: "Find a record", role: "text field" },
      { name: "Transactions", role: "header" },
    ],
  },
  {
    id: "plan-budget",
    title: "Plan a budget",
    nodes: [
      { name: "Plan", role: "tab", state: "selected" },
      { name: "Spent this month", role: "header" },
    ],
  },
];

export function journeyNames(id: string): string[] {
  return READER_JOURNEYS.find((row) => row.id === id)?.nodes.map((node) => node.name) ?? [];
}
