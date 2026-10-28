import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, View } from 'react-native';
import tokens from '../tokens.json';
import { useDesign, useTheme } from '../ThemeProvider';
import { Text } from './Text';

const sp = tokens.spacing;
const r = tokens.radius;
const m = tokens.motion;

/** For settings that apply at once. If Save has to be pressed, use a Checkbox (DESIGN.md 2.3). */
export function Switch({
  label,
  value,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const { reduceMotion } = useDesign();
  const [x] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) x.setValue(value ? 1 : 0);
    else Animated.timing(x, { toValue: value ? 1 : 0, duration: m['motion-base'], easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: false }).start();
  }, [value, reduceMotion, x]);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-md'], minHeight: 48, opacity: disabled ? 0.45 : 1 }}
    >
      <Text style={{ flexShrink: 1 }}>{label}</Text>
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: r['rounded-pill'],
          borderWidth: 1,
          borderColor: value ? theme.primaryFill : theme.inputBorder,
          backgroundColor: value ? theme.primaryFill : theme.card,
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: value ? theme.onPrimaryFill : theme.inputBorder,
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }],
          }}
        />
      </View>
    </Pressable>
  );
}

export type Option<T extends string> = { value: T; label: string };

/** Underlined tabs that switch a view's content. */
export function Tabs<T extends string>({ options, value, onChange, testID }: { options: Option<T>[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const theme = useTheme();
  return (
    <View testID={testID} accessibilityRole="tablist" style={{ flexDirection: 'row', gap: sp['spacing-lg'], borderBottomWidth: 1, borderColor: theme.border }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderColor: selected ? theme.link : 'transparent', marginBottom: -1 }}
          >
            <Text variant="button-sm" tone={selected ? 'text' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A pill-shaped choice between two to four options. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, testID }: { options: Option<T>[]; value: T; onChange: (v: T) => void; label: string; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignSelf: 'flex-start', padding: sp['spacing-xxs'], borderRadius: r['rounded-pill'], backgroundColor: theme.hover, borderWidth: 1, borderColor: theme.border }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={{ minHeight: 40, paddingHorizontal: sp['spacing-lg'], justifyContent: 'center', borderRadius: r['rounded-pill'], backgroundColor: selected ? theme.card : 'transparent' }}
          >
            <Text variant="button-sm" tone={selected ? 'text' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Whole-page or report waits over half a second. The Planexi logomark files aren't supplied yet
 * (docs/QUESTIONS.md Q-7), so a navy spinner stands in for the mark.
 */
export function LogomarkLoader({ label }: { label: string }) {
  const theme = useTheme();
  const { reduceMotion } = useDesign();
  return (
    <View testID="logomark-loader" accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ alignItems: 'center', gap: sp['spacing-md'], padding: sp['spacing-xl'] }}>
      {reduceMotion ? (
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.primaryFill }} />
      ) : (
        <ActivityIndicator color={theme.primaryFill} />
      )}
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
    </View>
  );
}
