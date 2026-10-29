/* PanResponder + Animated need mutable gesture state; refs are intentional. */
/* eslint-disable react-hooks/refs -- gesture handlers read/write refs outside paint */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';

import { Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';

const sp = tokens.spacing;
const ACTION_W = 88;
const OPEN_W = ACTION_W * 2;
const THRESHOLD = 48;

type Props = {
  children: ReactNode;
  enabled?: boolean;
  onDelete: () => void;
  onCategorize: () => void;
  testID?: string;
};

/**
 * Phone swipe actions: left reveal Categorize + Delete (DESIGN D18/D19, P11-11).
 * PanResponder only — no gesture-handler dependency.
 */
export function SwipeRow({ children, enabled = true, onDelete, onCategorize, testID }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [translateX] = useState(() => new Animated.Value(0));
  const startX = useRef(0);
  const openRef = useRef(open);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const settle = useCallback(
    (to: number) => {
      Animated.spring(translateX, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
      setOpen(to < 0);
    },
    [translateX],
  );

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
          enabledRef.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          translateX.stopAnimation((v) => {
            startX.current = typeof v === 'number' ? v : 0;
          });
        },
        onPanResponderMove: (_e, g) => {
          const next = Math.min(0, Math.max(-OPEN_W, startX.current + g.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const cur = startX.current + g.dx;
          if (g.vx < -0.4 || cur < -THRESHOLD) settle(-OPEN_W);
          else settle(0);
        },
        onPanResponderTerminate: () => settle(openRef.current ? -OPEN_W : 0),
      }).panHandlers,
    [settle, translateX],
  );

  // Web relies on keyboard / float bar / a11y; swipe is a phone gesture.
  if (!enabled || Platform.OS === 'web') {
    return <View testID={testID}>{children}</View>;
  }

  return (
    <View testID={testID} style={{ overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          width: OPEN_W,
        }}
      >
        <Pressable
          testID={testID ? `${testID}-categorize` : 'swipe-categorize'}
          accessibilityRole="button"
          accessibilityLabel={t('tx.float.categorize')}
          onPress={() => {
            settle(0);
            onCategorize();
          }}
          style={{
            width: ACTION_W,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.tagFill,
            paddingHorizontal: sp['spacing-sm'],
          }}
        >
          <Text variant="caption">{t('tx.float.categorize')}</Text>
        </Pressable>
        <Pressable
          testID={testID ? `${testID}-delete` : 'swipe-delete'}
          accessibilityRole="button"
          accessibilityLabel={t('tx.delete')}
          onPress={() => {
            settle(0);
            onDelete();
          }}
          style={{
            width: ACTION_W,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.error,
            paddingHorizontal: sp['spacing-sm'],
          }}
        >
          <Text variant="caption" style={{ color: '#fff' }}>
            {t('tx.delete')}
          </Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
