import type { IconName } from "@/design";

export const QUICK_ADD_TILES: { id: "expense" | "income" | "transfer"; label: string; icon: IconName }[] = [
  { id: "expense", label: "Expense", icon: "arrow-down-left" },
  { id: "income", label: "Income", icon: "plus" },
  { id: "transfer", label: "Transfer", icon: "arrow-left-right" },
];

export type QuickAddTile = (typeof QUICK_ADD_TILES)[number];
