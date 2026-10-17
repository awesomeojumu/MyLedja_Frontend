import { PlanModuleScreen } from "@/lib/plan-module-screen";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <PlanModuleScreen
      title="Debts"
      onBack={onBack}
      path="debts"
      empty="No debts yet"
      fields={[
        { key: "counterparty", label: "Who", value: "Ada" },
        { key: "principal", label: "Principal", value: "0.00" },
      ]}
      extra={{ direction: "i_owe" }}
    />
  );
}
