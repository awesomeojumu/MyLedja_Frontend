import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, CategoryIcon, Icon, Logo, Txt, formatMoney, nativeDriver, useTheme } from "@/design";
import { splitLayout } from "@/lib";
import { WELCOME_PREVIEW } from "@/features/auth-onboarding/auth-copy";

const NET = WELCOME_PREVIEW.reduce((sum, row) => sum + row.amount, 0);
const TILT = ["-3deg", "2deg", "-1deg"];
const INSET = [0, 14, 4];

/** 0 → 1 with a bouncy spring after `delay` ms. Starts at 1 (no motion) under reduce motion. */
function useSpringIn(delay: number, reduce: boolean, bounce = { friction: 5, tension: 60 }) {
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const anim = Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, useNativeDriver: nativeDriver(), ...bounce })]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return v;
}

/** A gentle endless 0 → 1 → 0 wave, for the coins and the breathing button. */
function useLoop(duration: number, delay: number, reduce: boolean) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) {
      v.setValue(0);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: ease, useNativeDriver: nativeDriver() }),
        Animated.timing(v, { toValue: 0, duration, easing: ease, useNativeDriver: nativeDriver() }),
      ]),
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return v;
}

/** Counts from ₦0 up to `target` once, easing out. */
function useCountUp(target: number, delay: number, reduce: boolean): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const t0 = Date.now() + delay;
    const step = () => {
      const k = Math.max(0, Math.min(1, (Date.now() - t0) / 1200));
      setShown(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, reduce]);
  return reduce ? target : shown;
}

function Drop({ v, tilt = "0deg", children, style }: { v: Animated.Value; tilt?: string; children: ReactNode; style?: object }) {
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            { rotate: tilt },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Coin({ size, top, right, delay }: { size: number; top: number; right: number; delay: number }) {
  const t = useTheme();
  const bob = useLoop(1500, delay, t.reduceMotion);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top,
        right,
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: "#FAC775",
        alignItems: "center",
        justifyContent: "center",
        transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
      }}
    >
      <Txt variant="label" color="#633806" style={{ fontSize: size * 0.45, lineHeight: size * 0.6 }}>
        ₦
      </Txt>
    </Animated.View>
  );
}

/** The navy hero: logo pops, the month's net counts up, three entries drop in and settle at a tilt, coins bob. */
function WelcomeHero({ compact }: { compact: boolean }) {
  const t = useTheme();
  const reduce = t.reduceMotion;
  const logo = useSpringIn(0, reduce, { friction: 4, tension: 80 });
  const balance = useSpringIn(250, reduce);
  const cards = [useSpringIn(450, reduce), useSpringIn(600, reduce), useSpringIn(750, reduce)];
  const net = useCountUp(NET, 300, reduce);
  return (
    <View style={{ flex: 1, gap: t.space.space5 }}>
      <View pointerEvents="none" style={{ position: "absolute", width: 260, height: 260, borderRadius: 999, backgroundColor: t.c.heroDeco, top: -110, right: -90 }} />
      <View pointerEvents="none" style={{ position: "absolute", width: 160, height: 160, borderRadius: 999, backgroundColor: t.c.heroDeco, bottom: compact ? 10 : -60, left: -80 }} />
      <Coin size={36} top={compact ? 70 : 64} right={compact ? 8 : 48} delay={1200} />
      <Coin size={24} top={compact ? 140 : 160} right={compact ? 64 : 110} delay={1900} />
      <Animated.View style={{ alignSelf: "flex-start", opacity: logo.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }), transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        <Logo size={compact ? 30 : 36} onHero />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: "center", gap: t.space.space4, maxWidth: 380 }}>
        <Drop v={balance}>
          <Txt variant="caption" color={t.c.onHeroMuted}>
            This month
          </Txt>
          <Txt variant="amountHero" color={t.c.onHero} style={{ fontSize: 32, lineHeight: 40 }}>
            {formatMoney(net).replace(/\.00$/, "")}
          </Txt>
        </Drop>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: t.space.space2 }}>
          {WELCOME_PREVIEW.map((row, i) => (
            <Drop key={row.title} v={cards[i]} tilt={TILT[i]} style={{ marginLeft: INSET[i], marginRight: 18 - INSET[i] }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: t.space.space3,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor: t.c.surface,
                }}
              >
                <CategoryIcon category={row.category} size="sm" />
                <View style={{ flex: 1 }}>
                  <Txt variant="label" numberOfLines={1}>
                    {row.title}
                  </Txt>
                  <Txt variant="caption" color={t.c.inkMuted} numberOfLines={1}>
                    {`${row.method} · ${row.time}`}
                  </Txt>
                </View>
                <Txt variant="label" color={row.amount < 0 ? t.c.danger : t.c.positive}>
                  {`${row.amount < 0 ? "−" : "+"}${formatMoney(Math.abs(row.amount)).replace(/\.00$/, "")}`}
                </Txt>
              </View>
            </Drop>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Headline, the two buttons and the trust line; fades in after the sheet lands. Create account breathes gently. */
function WelcomeActions({ onSignUp, onSignIn, delay }: { onSignUp: () => void; onSignIn: () => void; delay: number }) {
  const t = useTheme();
  const reduce = t.reduceMotion;
  const parts = [useSpringIn(delay, reduce, { friction: 7, tension: 50 }), useSpringIn(delay + 150, reduce, { friction: 7, tension: 50 }), useSpringIn(delay + 300, reduce, { friction: 7, tension: 50 })];
  const breathe = useLoop(1200, delay + 1200, reduce);
  const fade = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  });
  return (
    <View style={{ gap: t.space.space5 }}>
      <Animated.View style={[{ gap: 8 }, fade(parts[0])]}>
        <Txt variant="titleLg" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36 }}>
          Know where every naira goes.
        </Txt>
        <Txt color={t.c.inkMuted}>Cash, transfers and bills in seconds. Works offline, exact to the kobo.</Txt>
      </Animated.View>
      <Animated.View style={[{ gap: t.space.space3 }, fade(parts[1])]}>
        <Animated.View style={{ transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }}>
          <Button fullWidth size="lg" onPress={onSignUp}>
            Create account
          </Button>
        </Animated.View>
        <Button fullWidth size="lg" variant="secondary" onPress={onSignIn}>
          Sign in
        </Button>
      </Animated.View>
      <Animated.View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, fade(parts[2])]}>
        <Icon name="shield-check" size={14} color={t.c.inkMuted} />
        <Txt variant="caption" color={t.c.inkMuted}>
          We never ask for your bank password.
        </Txt>
      </Animated.View>
    </View>
  );
}

export function WelcomeScreen({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useSpringIn(900, t.reduceMotion, { friction: 6, tension: 45 });

  if (splitLayout(t.widthClass, t.portrait)) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.c.bg }}>
        <View style={{ flex: 2, backgroundColor: t.c.hero, padding: t.space.space8, overflow: "hidden" }}>
          <WelcomeHero compact={false} />
        </View>
        <View style={{ flex: 3, justifyContent: "center", padding: t.space.space8 }}>
          <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
            <WelcomeActions onSignUp={onSignUp} onSignIn={onSignIn} delay={500} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, overflow: "hidden" }}>
      <View style={{ flex: 1, backgroundColor: t.c.hero, overflow: "hidden", paddingTop: insets.top + t.space.space4, paddingHorizontal: t.space.space5, paddingBottom: t.space.space8 + t.space.space4 }}>
        <WelcomeHero compact />
      </View>
      <Animated.View
        style={{
          marginTop: -t.space.space6,
          backgroundColor: t.c.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: t.space.space5,
          paddingTop: t.space.space6,
          paddingBottom: Math.max(insets.bottom, t.space.space4) + t.space.space2,
          transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
        }}
      >
        <WelcomeActions onSignUp={onSignUp} onSignIn={onSignIn} delay={1300} />
      </Animated.View>
    </View>
  );
}
