import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Txt, useTheme } from "@/design";
import { PlanCreateForm } from "@/lib/plan-create-form";
import { PlanLiveList } from "@/lib/plan-live-list";

export function PlanModuleScreen({
  title,
  onBack,
  path,
  empty,
  fields,
  extra,
  pickAccount,
  header,
}: {
  title: string;
  onBack?: () => void;
  path: string;
  empty: string;
  fields: { key: string; label: string; value?: string }[];
  extra?: Record<string, unknown>;
  pickAccount?: boolean;
  header?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [tick, setTick] = useState(0);
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {onBack ? (
        <View style={{ paddingTop: insets.top + t.space.space2, paddingHorizontal: t.space.space3 }}>
          <IconButton icon="chevron-left" label="Back" onPress={onBack} />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          paddingTop: onBack ? t.space.space2 : insets.top + t.space.space4,
          paddingHorizontal: t.space.space4,
          paddingBottom: t.space.space12,
          gap: t.space.space4,
        }}
      >
        <Txt variant="titleMd" accessibilityRole="header">
          {title}
        </Txt>
        {header}
        <PlanLiveList path={path} empty={empty} refreshToken={tick} />
        <PlanCreateForm
          path={path}
          fields={fields}
          extra={extra}
          pickAccount={pickAccount}
          onSaved={() => setTick((n) => n + 1)}
        />
      </ScrollView>
    </View>
  );
}
