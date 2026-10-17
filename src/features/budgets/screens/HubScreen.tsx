import { PlanModuleScreen } from "@/lib/plan-module-screen";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <PlanModuleScreen
      title="Budgets"
      onBack={onBack}
      path="budgets"
      empty="No budgets yet"
      pickAccount
      fields={[{ key: "amount", label: "Monthly amount", value: "1000.00" }]}
      extra={{ primaryPeriod: "month" }}
    />
  );
}
