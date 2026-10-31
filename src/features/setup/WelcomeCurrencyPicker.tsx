import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { currencyLabel, filterCurrencies } from './currencies';

export function WelcomeCurrencyPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const options = useMemo(() => filterCurrencies(query), [query]);
  const showList = focused || query.length > 0;

  return (
    <View style={{ gap: tokens.spacing['spacing-sm'] }}>
      <Text variant="caption" tone="textSecondary">
        {t('welcome.step2.currency')}
      </Text>
      <TextInput
        testID="currency-search"
        label={t('welcome.step2.currencySearch')}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={currencyLabel(value)}
      />
      {showList ? (
        <View
          testID="currency-options"
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: tokens.radius['rounded-md'],
            overflow: 'hidden',
            maxHeight: 280,
          }}
        >
          {options.map((c) => (
            <Pressable
              key={c.code}
              testID={`currency-${c.code}`}
              accessibilityRole="button"
              accessibilityState={{ selected: c.code === value }}
              onPress={() => {
                onChange(c.code);
                setQuery('');
                setFocused(false);
              }}
              style={{
                padding: tokens.spacing['spacing-md'],
                backgroundColor: c.code === value ? theme.tagFill : theme.card,
              }}
            >
              <Text>{currencyLabel(c.code)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text testID="currency-selected" variant="caption">
          {currencyLabel(value)}
        </Text>
      )}
    </View>
  );
}
