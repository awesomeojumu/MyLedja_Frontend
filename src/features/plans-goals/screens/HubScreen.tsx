import { PlanModuleScreen } from "@/lib/plan-module-screen";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <PlanModuleScreen
      title="Goals"
      onBack={onBack}
      path="goals"
      empty="No goals yet"
      fields={[
        { key: "name", label: "Name", value: "Emergency" },
        { key: "target", label: "Target", value: "10000.00" },
      ]}
    />
  );
}
