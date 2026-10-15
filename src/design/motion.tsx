/* Shared motion: springy press, rise-in on arrival, rolling numbers. Transform and opacity only, native driver. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from './theme';
import { spring as springs } from './tokens';
import { haptic, HapticMoment } from './haptics';

export interface SpringPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far it presses down (scale). */
  depth?: number;
  hapticOn?: HapticMoment;
  children?: React.ReactNode;
}

/** A Pressable that springs down on touch and back on release. Instant under reduce-motion. */
export function SpringPressable({ style, depth = 0.95, hapticOn, onPressIn, onPressOut, onPress, children, ...rest }: SpringPressableProps) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (t.reduceMotion) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: v, useNativeDriver: true, ...springs.press }).start();
  };
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => { to(depth); onPressIn?.(e); }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
      onPress={(e) => { if (hapticOn) haptic(hapticOn, t.haptics); onPress?.(e); }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Rises 10px and fades in once, after `delay` ms (use index × 40 for a stagger). */
export function Rise({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(t.reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (t.reduceMotion) return;
    Animated.spring(v, { toValue: 1, delay, useNativeDriver: true, ...springs.settle }).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** A number that rolls from its old value to the new one over 520ms (eased). */
export function useRollingNumber(target: number, reduceMotion: boolean, from?: number): number {
  const [shown, setShown] = useState(from ?? target * 0.92);
  const ref = useRef(shown);
  useEffect(() => {
    if (reduceMotion || ref.current === target) { ref.current = target; setShown(target); return; }
    const start = ref.current; const t0 = Date.now(); let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 520), e = 1 - Math.pow(1 - k, 3);
      const v = start + (target - start) * e; ref.current = v; setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduceMotion]);
  return Math.round(shown * 100) / 100;
}
