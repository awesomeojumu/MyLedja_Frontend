import { PlanModuleScreen } from "@/lib/plan-module-screen";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return (
    <PlanModuleScreen
      title="Bills"
      onBack={onBack}
      path="bills"
      empty="No bills yet"
      fields={[
        { key: "name", label: "Name", value: "DSTV" },
        { key: "amount", label: "Amount", value: "50.00" },
      ]}
      extra={{ cadence: "monthly" }}
    />
  );
}
