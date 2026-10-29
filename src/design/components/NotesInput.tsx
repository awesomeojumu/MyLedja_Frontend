import { useState } from 'react';
import { View } from 'react-native';
import { t } from '@/i18n';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { notesFieldError } from './fieldKinds';
import { Text } from './Text';
import { TextInput } from './TextInput';

/** Several lines, up to 500 characters, with a counter from 400 (addendum §1.1 Notes). */
export function NotesInput({
  label,
  value,
  onChange,
  testID,
  showError = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  testID?: string;
  showError?: boolean;
}) {
  const theme = useTheme();
  const [blurred, setBlurred] = useState(false);
  const reveal = blurred || showError;
  const error = reveal ? notesFieldError(value) : null;
  const showCounter = value.length >= 400;
  return (
    <View style={{ gap: tokens.spacing['spacing-xs'] }}>
      <TextInput
        label={label}
        testID={testID}
        value={value}
        onChangeText={onChange}
        onBlur={() => setBlurred(true)}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={{ minHeight: 96 }}
        error={error}
      />
      {showCounter ? (
        <Text
          testID={testID ? `${testID}-counter` : 'notes-counter'}
          variant="caption"
          style={{ color: value.length > 500 ? theme.error : theme.textHelper, alignSelf: 'flex-end' }}
        >
          {t('fields.notesCounter', { used: value.length, max: 500 })}
        </Text>
      ) : null}
    </View>
  );
}
