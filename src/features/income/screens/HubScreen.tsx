import { PlanModuleScreen } from "@/lib/plan-module-screen";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <PlanModuleScreen
      title="Income"
      onBack={onBack}
      path="income-streams"
      empty="No income streams yet"
      fields={[
        { key: "name", label: "Name", value: "Salary" },
        { key: "expected", label: "Expected", value: "0.00" },
      ]}
      extra={{ taxClass: "paye" }}
    />
  );
}
