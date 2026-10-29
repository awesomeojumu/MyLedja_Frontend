import { useState } from 'react';
import { t } from '@/i18n';
import { percentFieldError } from './fieldKinds';
import { TextInput } from './TextInput';

/** 0 to 100, up to 2 decimals, "%" after the field (addendum §1.1 Percent). */
export function PercentInput({
  label,
  value,
  onChange,
  testID,
  required = false,
  showError = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  testID?: string;
  required?: boolean;
  showError?: boolean;
}) {
  const [blurred, setBlurred] = useState(false);
  const reveal = blurred || showError;
  const error = reveal ? percentFieldError(value, { required }) : null;
  return (
    <TextInput
      label={label}
      testID={testID}
      value={value}
      onChangeText={onChange}
      onBlur={() => setBlurred(true)}
      keyboardType="decimal-pad"
      inputMode="decimal"
      placeholder={t('fields.percentPlaceholder')}
      caption={error ? undefined : '%'}
      error={error}
    />
  );
}
