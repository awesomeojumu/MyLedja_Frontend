import type { ReactNode } from "react";
import { View } from "react-native";
import { Banner, EmptyState, Skeleton, useTheme, type IconName } from "@/design";
import { ScreenShell } from "@/lib/screen-shell";

export interface PageScaffoldProps {
  id?: string;
  title: string;
  loading?: boolean;
  offline?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: { label: string; icon?: IconName; onPress?: () => void };
  emptyIcon?: IconName;
  onRetry?: () => void;
  showBack?: boolean;
  actions?: { icon: IconName; label: string; onPress: () => void }[];
  footer?: ReactNode;
  children: ReactNode;
}

export function PageScaffold({
  title,
  loading = false,
  offline = false,
  error = null,
  empty = false,
  emptyTitle = "Nothing here yet",
  emptyBody,
  emptyAction,
  emptyIcon = "inbox",
  onRetry,
  showBack = true,
  actions,
  footer,
  children,
}: PageScaffoldProps) {
  const t = useTheme();

  return (
    <ScreenShell
      title={title}
      showBack={showBack}
      actions={actions}
      footer={footer}
    >
      {offline ? (
        <Banner
          tone="neutral"
          icon="wifi-off"
          title="Offline"
          action={onRetry ? { label: "Retry", onPress: onRetry } : undefined}
        >
          Showing saved data from your phone.
        </Banner>
      ) : null}

      {error ? (
        <Banner
          tone="danger"
          icon="circle-alert"
          title="Couldn't refresh"
          action={onRetry ? { label: "Try again", onPress: onRetry } : undefined}
        >
          {error}
        </Banner>
      ) : null}

      {loading ? (
        <View style={{ gap: t.space.space3, paddingVertical: t.space.space2 }}>
          <Skeleton variant="card" />
          <Skeleton variant="row" />
          <Skeleton variant="row" />
          <Skeleton variant="text" lines={3} />
        </View>
      ) : empty ? (
        <EmptyState
          title={emptyTitle}
          icon={emptyIcon}
          action={emptyAction}
        >
          {emptyBody}
        </EmptyState>
      ) : (
        children
      )}
    </ScreenShell>
  );
}
