import { FeatureHub } from "@/lib/feature-hub";
import { FEATURE_SCREENS } from "@/lib/screen-catalog";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return <FeatureHub title="Help" ids={FEATURE_SCREENS["help-support"]} onBack={onBack} />;
}
