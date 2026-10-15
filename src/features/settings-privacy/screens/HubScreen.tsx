import { FeatureHub } from "../../../lib/feature-hub";
import { FEATURE_SCREENS } from "../../../lib/screen-catalog";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  return <FeatureHub title="Settings" ids={FEATURE_SCREENS["settings-privacy"]} onBack={onBack} />;
}
