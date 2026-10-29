import { useState } from 'react';
import { textFieldError } from './fieldKinds';
import { TextInput } from './TextInput';

/** One-line Text kind: required empty → "Add a name" (or named), over 60 → exact words. */
export function NameInput({
  label,
  value,
  onChange,
  testID,
  required = true,
  fieldNoun,
  showError = false,
  optional,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  testID?: string;
  required?: boolean;
  /** When set, empty error is "Add a {fieldNoun}" instead of "Add a name". */
  fieldNoun?: string;
  showError?: boolean;
  optional?: boolean;
}) {
  const [blurred, setBlurred] = useState(false);
  const reveal = blurred || showError;
  const error = reveal ? textFieldError(value, { required: required && !optional, fieldNoun }) : null;
  return (
    <TextInput
      label={optional ? `${label} (optional)` : label}
      testID={testID}
      value={value}
      onChangeText={onChange}
      onBlur={() => setBlurred(true)}
      error={error}
    />
  );
}
