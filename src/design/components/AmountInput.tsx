import { useState } from 'react';
import { formatNaira, parseAmount } from '@/money';
import { t } from '@/i18n';
import { TextInput } from './TextInput';

/** Opens the number keypad on phones; live-formats to ₦18,450.00 while typing (A-02). */
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
      onBlur={() => {
        setTouched(true);
        if (value.trim() === '') return;
        const p = parseAmount(value);
        if (p.ok) onChange(formatNaira(p.minor), p.minor);
      }}
      onChangeText={(text) => {
        setTouched(true);
        if (text.trim() === '') {
          onChange('', null);
          return;
        }
        const p = parseAmount(text);
        if (p.ok) {
          onChange(formatNaira(p.minor), p.minor);
          return;
        }
        // Keep the typed text so the person can finish (or see why it was refused).
        onChange(text, null);
      }}
    />
  );
}
