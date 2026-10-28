import { Pressable, View, type PressableProps } from 'react-native';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export type ButtonKind = 'primary-pill' | 'secondary' | 'gradient' | 'link';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  kind?: ButtonKind;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
};

const c = tokens.color;

export function Button({ label, kind = 'primary-pill', size = 'md', fullWidth, disabled, style, ...rest }: Props) {
  const theme = useTheme();
  const isLink = kind === 'link';
  return (
    <Pressable
      accessibilityRole={isLink ? 'link' : 'button'}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={isLink ? 12 : undefined}
      {...rest}
      style={(state) => {
        const pressed = state.pressed;
        const base = isLink
          ? { paddingVertical: tokens.spacing['spacing-xs'] }
          : {
              minHeight: 44,
              paddingVertical: tokens.spacing['spacing-sm'],
              paddingHorizontal: tokens.spacing['spacing-lg'],
              borderRadius: tokens.radius['rounded-pill'],
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              transform: pressed ? [{ scale: 0.98 }] : undefined,
            };
        const look =
          kind === 'primary-pill'
            ? { backgroundColor: pressed ? c['primary-press'] : theme.primaryFill }
            : kind === 'gradient'
              ? {
                  backgroundColor: pressed ? c['primary-press'] : c.primary,
                  borderWidth: 1,
                  borderColor: theme.gold,
                  experimental_backgroundImage: `linear-gradient(120deg, ${c.primary}, ${c['primary-deep']})`,
                }
              : kind === 'secondary'
                ? { borderWidth: 1, borderColor: theme.inputBorder, backgroundColor: theme.card }
                : {};
        const userStyle = typeof style === 'function' ? style(state) : style;
        return [base, look, fullWidth && { alignSelf: 'stretch' as const }, disabled && { opacity: 0.45 }, userStyle];
      }}
    >
      <View>
        <Text
          variant={size === 'md' ? 'button-md' : 'button-sm'}
          tone={kind === 'primary-pill' ? 'onPrimaryFill' : isLink ? 'link' : 'text'}
          style={kind === 'gradient' ? { color: c['on-primary'] } : undefined}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
