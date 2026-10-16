import type { ReactNode } from "react";
import { ScreenShell } from "../../../lib";
import type { IconName } from "../../../design";

export function AccountScreenShell({
  title,
  backLabel = "Back",
  onBack,
  actions,
  footer,
  demo = false,
  emptyTitle,
  emptyBody,
  emptyAction,
  errorTitle,
  errorBody,
  children,
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: { icon: IconName; label: string; onPress: () => void }[];
  footer?: ReactNode;
  demo?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: { label: string; icon?: IconName; onPress?: () => void };
  errorTitle?: string;
  errorBody?: string;
  children: ReactNode;
}) {
  return (
    <ScreenShell
      title={title}
      backLabel={backLabel}
      onBack={onBack}
      homeHref="/(tabs)/accounts"
      demo={demo}
      actions={actions}
      footer={footer}
      emptyTitle={emptyTitle}
      emptyBody={emptyBody}
      emptyAction={emptyAction}
      errorTitle={errorTitle}
      errorBody={errorBody}
    >
      {children}
    </ScreenShell>
  );
}
