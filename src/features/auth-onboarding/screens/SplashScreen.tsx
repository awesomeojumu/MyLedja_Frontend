import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Icon, Logo, Txt, useTheme } from "@/design";
import { isWarmed, warmupSession } from "@/lib/session-warmup";
import { useSession } from "@/state";

const MIN_MS = 600;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { session, workspaces, user } = useSession();

  useEffect(() => {
    if (isWarmed()) {
      onDone();
      return;
    }
    let alive = true;
    const started = Date.now();
    void warmupSession(session, workspaces[0]?.id, user?.userId).finally(() => {
      const wait = Math.max(0, MIN_MS - (Date.now() - started));
      setTimeout(() => {
        if (alive) onDone();
      }, wait);
    });
    return () => {
      alive = false;
    };
  }, [onDone, session, user?.userId, workspaces]);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.hero, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: t.c.heroDeco,
          top: -80,
          right: -60,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: t.c.heroDeco,
          bottom: -70,
          left: -50,
        }}
      />
      <View style={{ alignItems: "center", gap: t.space.space4 }}>
        <Logo size={48} onHero />
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
          <ActivityIndicator color={t.c.onHeroMuted} />
          <Txt color={t.c.onHeroMuted}>Opening your records…</Txt>
        </View>
      </View>
      <View style={{ position: "absolute", bottom: t.space.space8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="shield-check" size={16} color={t.c.onHeroMuted} />
        <Txt variant="caption" color={t.c.onHeroMuted}>
          Encrypted on this device
        </Txt>
      </View>
    </View>
  );
}
