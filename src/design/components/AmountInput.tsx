import { useState } from 'react';
import { parseAmount } from '@/money';
import { t } from '@/i18n';
import { TextInput } from './TextInput';

/** Opens the number keypad on phones; reports kobo or null while the text can't be read. */
export function AmountInput({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (text: string, minor: bigint | null) => void;
  testID?: string;
}) {
  const [touched, setTouched] = useState(false);
  const parsed = value.trim() === '' ? null : parseAmount(value);
  const error = touched && parsed && !parsed.ok ? t('money.unreadable') : null;
  return (
    <TextInput
      label={label}
      testID={testID}
      value={value}
      keyboardType="decimal-pad"
      inputMode="decimal"
      placeholder={t('money.placeholder')}
      error={error}
      onBlur={() => setTouched(true)}
      onChangeText={(text) => {
        setTouched(true);
        const p = text.trim() === '' ? null : parseAmount(text);
        onChange(text, p && p.ok ? p.minor : null);
      }}
    />
  );
}
