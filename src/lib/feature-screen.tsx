import { View } from "react-native";
import { EmptyState, Txt, useTheme } from "@/design";
import { SCREEN_TITLES } from "@/lib/screen-catalog";
import { PlanLiveList } from "@/lib/plan-live-list";

const LIVE_PATH: Record<string, string> = {
  "048": "budgets",
  "049": "budgets",
  "050": "budgets",
  "051": "budgets",
  "052": "budgets",
  "053": "budgets",
  "054": "budgets",
  "055": "budgets",
  "056": "budgets",
  "057": "budgets",
  "058": "bills",
  "059": "bills",
  "060": "bills",
  "061": "bills",
  "062": "bills",
  "063": "bills",
  "064": "bills",
  "065": "bills",
  "066": "bills",
  "150": "bills",
  "067": "goals",
  "068": "goals",
  "069": "goals",
  "070": "goals",
  "071": "goals",
  "072": "goals",
  "073": "goals",
  "074": "goals",
  "075": "income-streams",
  "076": "income-streams",
  "077": "income-streams",
  "078": "income-streams",
  "079": "income-streams",
  "080": "income-streams",
  "081": "income-streams",
  "082": "debts",
  "083": "debts",
  "084": "debts",
  "085": "debts",
  "086": "debts",
  "087": "debts",
  "088": "debts",
  "089": "debts",
  "151": "debts",
};

export function FeatureScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  const path = LIVE_PATH[id];
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">{title}</Txt>
      {path ? <PlanLiveList path={path} empty={`No ${title.toLowerCase()} yet`} /> : <Txt variant="body">Ready.</Txt>}
    </View>
  );
}

export function GatedScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd" accessibilityRole="header">{title}</Txt>
      <EmptyState title="Not available yet" icon="ban">
        Savings, investments, and tax filing are not available yet.
      </EmptyState>
    </View>
  );
}
