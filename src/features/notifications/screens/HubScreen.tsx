import { GatedCopy } from "@/lib/gated-copy";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return <GatedCopy title="Notifications" onBack={onBack} />;
}
