import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Icon, SectionHeader, Txt, useTheme } from "../design";

export function LinkHub({
  title,
  links,
  footer,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
  footer?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + t.space.space4,
          paddingHorizontal: t.space.space4,
          paddingBottom: t.space.space12,
          gap: t.space.space4,
        }}
      >
        <SectionHeader title={title} />
        <Card flat>
          {links.map((link) => (
            <Pressable
              key={link.href}
              onPress={() => router.push(link.href)}
              accessibilityRole="link"
              style={{ flexDirection: "row", alignItems: "center", minHeight: t.size.touchTarget, gap: t.space.space3 }}
            >
              <Txt variant="label" style={{ flex: 1, fontWeight: "600" }}>
                {link.label}
              </Txt>
              <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
            </Pressable>
          ))}
        </Card>
        {footer}
      </ScrollView>
    </View>
  );
}
