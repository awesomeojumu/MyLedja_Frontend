import { useState } from 'react';
import { formatNaira, parseAmount } from '@/money';
import { t } from '@/i18n';
import { amountFieldError } from './fieldKinds';
import { TextInput } from './TextInput';

/** Opens the number keypad on phones; live-formats to ₦18,450.00 while typing (A-02). Errors only after blur or Save. */
export function AmountInput({
  label,
  value,
  onChange,
  testID,
  allowZero = false,
  required = false,
  showError = false,
}: {
  label: string;
  value: string;
  onChange: (text: string, minor: bigint | null) => void;
  testID?: string;
  /** Opening balances and some edits may be ₦0.00. */
  allowZero?: boolean;
  required?: boolean;
  /** Parent sets true on Save so errors show without waiting for blur. */
  showError?: boolean;
}) {
  const [blurred, setBlurred] = useState(false);
  const reveal = blurred || showError;
  const error = reveal ? amountFieldError(value, { allowZero, required }) : null;
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
        setBlurred(true);
        if (value.trim() === '') return;
        const p = parseAmount(value);
        if (p.ok) onChange(formatNaira(p.minor), p.minor);
      }}
      onChangeText={(text) => {
        if (text.trim() === '') {
          onChange('', null);
          return;
        }
        const p = parseAmount(text);
        if (p.ok) {
          onChange(formatNaira(p.minor), p.minor);
          return;
        }
        // Keep the typed text so the person can finish (or see why it was refused after blur).
        onChange(text, null);
      }}
    />
  );
}
