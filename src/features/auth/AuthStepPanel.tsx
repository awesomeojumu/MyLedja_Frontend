import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import tokens from '@/design/tokens.json';
import { useReduceMotion } from '@/design/components';

const m = tokens.motion;

/** Short slide when auth steps swap inside the card (DESIGN pages 1–3). */
export function AuthStepPanel({ step, children }: { step: string; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const prev = useRef(step);
  const [x] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (prev.current === step) return;
    prev.current = step;
    if (reduceMotion) {
      x.setValue(0);
      opacity.setValue(1);
      return;
    }
    x.setValue(12);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(x, { toValue: 0, duration: m['motion-base'], easing: Easing.bezier(...m['ease-out']), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: m['motion-base'], easing: Easing.bezier(...m['ease-out']), useNativeDriver: true }),
    ]).start();
  }, [step, reduceMotion, x, opacity]);

  return (
    <Animated.View style={{ gap: tokens.spacing['spacing-lg'], transform: [{ translateX: x }], opacity }}>
      {children}
    </Animated.View>
  );
}
