import { forwardRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { t } from '@/i18n';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { Text, typeStyle } from './Text';

export type TextInputProps = RNTextInputProps & {
  label: string;
  error?: string | null;
  caption?: string;
  secure?: boolean;
};

export const TextInput = forwardRef<ComponentRef<typeof RNTextInput>, TextInputProps>(function TextInput(
  { label, error, caption, secure, style, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: tokens.spacing['spacing-xs'] }}>
      <Text variant="caption" tone="textSecondary" nativeID={`${rest.testID ?? label}-label`}>
        {label}
      </Text>
      <View style={{ justifyContent: 'center' }}>
        <RNTextInput
          ref={ref}
          accessibilityLabel={label}
          aria-invalid={!!error}
          placeholderTextColor={theme.textHelper}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
          style={[
            typeStyle('body-md'),
            {
              color: theme.text,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: error ? theme.error : focused ? theme.link : theme.inputBorder,
              borderRadius: tokens.radius['rounded-sm'],
              paddingVertical: tokens.spacing['spacing-sm'],
              paddingHorizontal: tokens.spacing['spacing-md'],
              paddingRight: secure ? 88 : tokens.spacing['spacing-md'],
              minHeight: 48,
              boxShadow: focused ? `0 0 0 3px ${tokens.color['primary-bg-subdued-hover']}` : undefined,
            },
            style,
          ]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('common.showPassword') : t('common.hidePassword')}
            onPress={() => setHidden((h) => !h)}
            style={{ position: 'absolute', right: tokens.spacing['spacing-md'], minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="caption" tone="link">
              {hidden ? t('common.showPassword') : t('common.hidePassword')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" accessibilityRole="alert" testID={`${rest.testID ?? 'field'}-error`}>
          {error}
        </Text>
      ) : caption ? (
        <Text variant="caption" tone="textHelper">
          {caption}
        </Text>
      ) : null}
    </View>
  );
});
