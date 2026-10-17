import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, EmptyState, IconButton, SectionHeader, Txt, useTheme } from "@/design";

export function FeatureHub({
  title,
  ids,
  onBack,
  header,
}: {
  title: string;
  ids: readonly string[];
  onBack?: () => void;
  header?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
        <SectionHeader title={title} meta={`${ids.length} screens`} />
        {header}
        <EmptyState title={`${title} is ready for records`} icon="inbox">
          The design system is in place. These screens still need their own layouts.
        </EmptyState>
        <Card flat title="Screen contracts">
          {ids.map((id) => (
            <Txt key={id} variant="caption" color={t.c.inkMuted}>
              {id}
            </Txt>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
