import { useRef, type ComponentRef } from 'react';
import { TextInput as RNTextInput, View } from 'react-native';
import { t } from '@/i18n';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { Text, typeStyle } from './Text';

const LENGTH = 6;

/** Six boxes that auto-advance and accept a pasted code. */
export function CodeInput({
  value,
  onChange,
  error,
  testID = 'code',
}: {
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
  testID?: string;
}) {
  const theme = useTheme();
  const refs = useRef<(ComponentRef<typeof RNTextInput> | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  const handle = (index: number, text: string) => {
    const clean = text.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = (value.slice(0, index) + clean).slice(0, LENGTH);
      onChange(next);
      refs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      return;
    }
    const chars = digits.slice();
    chars[index] = clean;
    onChange(chars.join('').slice(0, LENGTH));
    if (clean && index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  return (
    <View style={{ gap: tokens.spacing['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', gap: tokens.spacing['spacing-sm'] }}>
        {digits.map((d, i) => (
          <RNTextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            testID={`${testID}-${i}`}
            accessibilityLabel={t('signUp.codeDigit', { n: i + 1 })}
            value={d}
            onChangeText={(text) => handle(i, text)}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
            }}
            keyboardType="number-pad"
            textContentType={i === 0 ? 'oneTimeCode' : 'none'}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            style={[
              typeStyle('heading-lg'),
              {
                width: 44,
                height: 52,
                textAlign: 'center',
                color: theme.text,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: error ? theme.error : theme.inputBorder,
                borderRadius: tokens.radius['rounded-sm'],
                fontVariant: ['tabular-nums'],
              },
            ]}
          />
        ))}
      </View>
      {error ? (
        <Text variant="caption" accessibilityRole="alert" testID={`${testID}-error`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
