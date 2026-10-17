import type { ReactNode } from "react";
import { FeatureHub } from "@/lib/feature-hub";
import { FEATURE_SCREENS } from "@/lib/screen-catalog";

export function HubScreen({ onBack, header }: { onBack?: () => void; header?: ReactNode } = {}) {
  return <FeatureHub title="Settings" ids={FEATURE_SCREENS["settings-privacy"]} onBack={onBack} header={header} />;
}
