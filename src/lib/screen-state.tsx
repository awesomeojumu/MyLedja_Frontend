import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { Banner, EmptyState, SegmentedControl, Skeleton, useTheme } from "../design";
import { SCREEN_PREVIEW_OPTIONS, type ScreenPreview } from "./screen-preview";

export type { ScreenPreview } from "./screen-preview";
export { SCREEN_PREVIEW_OPTIONS } from "./screen-preview";

export function useScreenPreview(initial: ScreenPreview = "ready"): [ScreenPreview, (value: ScreenPreview) => void] {
  return useState<ScreenPreview>(initial);
}

export function ScreenStateSwitch({
  value,
  onChange,
}: {
  value: ScreenPreview;
  onChange: (value: ScreenPreview) => void;
}) {
  return (
    <SegmentedControl
      label="Design state"
      options={SCREEN_PREVIEW_OPTIONS}
      value={value}
      onChange={(next) => onChange(next as ScreenPreview)}
    />
  );
}

export function DefaultLoading() {
  return (
    <View>
      <Skeleton variant="card" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </View>
  );
}

export function ScreenStateGate({
  state,
  loading,
  empty,
  errorTitle = "Could not load this screen",
  errorBody = "Try again. Nothing was lost on this phone.",
  offlineTitle = "You're offline",
  offlineBody = "You can still read what is already on this phone.",
  children,
}: {
  state: ScreenPreview;
  loading?: ReactNode;
  empty?: ReactNode;
  errorTitle?: string;
  errorBody?: string;
  offlineTitle?: string;
  offlineBody?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  if (state === "loading") return <>{loading ?? <DefaultLoading />}</>;
  if (state === "empty") {
    return (
      <>
        {empty ?? (
          <EmptyState title="Nothing here yet" icon="inbox">
            Add a record to see it on this screen.
          </EmptyState>
        )}
      </>
    );
  }
  if (state === "error") {
    return (
      <Banner tone="danger" title={errorTitle} icon="circle-alert">
        {errorBody}
      </Banner>
    );
  }
  if (state === "offline") {
    return (
      <View style={{ gap: t.space.space4 }}>
        <Banner tone="neutral" title={offlineTitle} icon="wifi-off">
          {offlineBody}
        </Banner>
        {children}
      </View>
    );
  }
  return <>{children}</>;
}
