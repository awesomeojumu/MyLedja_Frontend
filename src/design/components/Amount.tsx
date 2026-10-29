import { formatMoney, PRIVACY_MASK, type FormatOptions } from '@/money';
import { t } from '@/i18n';
import { useDesign } from '../ThemeProvider';
import { Text, type TypeStyle } from './Text';

type Props = FormatOptions & {
  minor: bigint;
  /** Another currency shows its own symbol (DESIGN.md 2.6). */
  currency?: string;
  variant?: TypeStyle;
  testID?: string;
};

export function Amount({ minor, currency, variant = 'body-tabular', testID, ...format }: Props) {
  const { privacy } = useDesign();
  const formatted = formatMoney(minor, currency, format);
  if (privacy) {
    // Keep the real figure's width so layouts don't move when privacy turns on.
    return (
      <Text variant={variant} testID={testID} accessibilityLabel={t('money.privacyLabel')}>
        {PRIVACY_MASK.padEnd(formatted.length, '\u2007')}
      </Text>
    );
  }
  return (
    <Text variant={variant} testID={testID} style={{ fontVariant: ['tabular-nums'] }}>
      {formatted}
    </Text>
  );
}
