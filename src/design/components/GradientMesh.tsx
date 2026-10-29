import { useEffect, useMemo } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import tokens from '../tokens.json';

const c = tokens.color;

// Cream, navy tint and navy across the upper third, with a faint gold stop (DESIGN.md 2.10).
const BLOBS = [
  { id: 'navy', cx: '15%', cy: '0%', r: '55%', color: c.primary, opacity: 0.9 },
  { id: 'tint', cx: '60%', cy: '5%', r: '45%', color: c['primary-bg-subdued-hover'], opacity: 1 },
  { id: 'cream', cx: '92%', cy: '0%', r: '40%', color: c['canvas-cream'], opacity: 1 },
  { id: 'gold', cx: '40%', cy: '28%', r: '30%', color: c.gold, opacity: 0.12 },
];

/** Drawn with SVG so it paints the same on iOS, Android and web. Web drifts over motion-ambient; phones stay still. */
export function GradientMesh() {
  const drift = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: tokens.motion['motion-ambient'] / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: tokens.motion['motion-ambient'] / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        Platform.OS === 'web' ? { transform: [{ translateX }, { translateY }, { scale: 1.08 }] } : null,
      ]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" testID="gradient-mesh-art">
        <Defs>
          {BLOBS.map((b) => (
            <RadialGradient key={b.id} id={b.id} cx={b.cx} cy={b.cy} rx={b.r} ry={b.r} fx={b.cx} fy={b.cy} gradientUnits="objectBoundingBox">
              <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset="1" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {BLOBS.map((b) => (
          <Rect key={b.id} x="0" y="0" width="100%" height="100%" fill={`url(#${b.id})`} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** The navy gradient band (primary to primary-deep at 120 degrees). */
export function GradientBand() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="band" x1="0" y1="0" x2="1" y2="0.58">
          <Stop offset="0" stopColor={c.primary} />
          <Stop offset="1" stopColor={c['primary-deep']} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#band)" />
    </Svg>
  );
}
