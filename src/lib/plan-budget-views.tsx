import { View } from "react-native";
import { Txt, useTheme } from "@/design";
import { nairaText, remainingText } from "@/lib/budget-text";
import { budgetViewKeys } from "@/lib/plan-screen-role";

export interface BudgetViewsData {
  spent: string;
  remaining: string;
  views: Record<string, { value: string; basis?: string }>;
}

const VIEW_LABEL: Record<string, string> = {
  day: "Spent today",
  week: "Spent this week",
  month: "Spent this month",
  year: "Spent this year",
};

export function PlanBudgetViews({ data }: { data: BudgetViewsData | null }) {
  const t = useTheme();
  if (!data) return null;
  const keys = budgetViewKeys();
  const bases = keys.map((key) => data.views[key]?.basis).filter((basis): basis is string => Boolean(basis));
  const shared = bases.length > 0 && bases.every((basis) => basis === bases[0]) ? bases[0] : null;
  return (
    <View style={{ gap: t.space.space3 }}>
      <Txt
        variant="body"
        style={{ fontWeight: "600" }}
        accessibilityLabel={`${nairaText(data.spent)} spent · ${remainingText(data.remaining)}`}
      >
        {nairaText(data.spent)} spent · {remainingText(data.remaining)}
      </Txt>
      {keys.map((key) => (
        <View
          key={key}
          accessible
          accessibilityLabel={`${VIEW_LABEL[key] ?? key} ${nairaText(data.views[key]?.value)}`}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" color={t.c.inkMuted}>
              {VIEW_LABEL[key] ?? key}
            </Txt>
            {!shared && data.views[key]?.basis ? (
              <Txt variant="caption" color={t.c.inkMuted}>
                {data.views[key]?.basis}
              </Txt>
            ) : null}
          </View>
          <Txt variant="body" style={{ fontVariant: ["tabular-nums"] }}>
            {nairaText(data.views[key]?.value)}
          </Txt>
        </View>
      ))}
      {shared ? (
        <Txt variant="caption" color={t.c.inkMuted}>
          {shared}
        </Txt>
      ) : null}
    </View>
  );
}
