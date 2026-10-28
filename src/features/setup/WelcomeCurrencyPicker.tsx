import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { filterCurrencies } from './welcomeCurrencies';

export function WelcomeCurrencyPicker() {
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
        placeholder={t('welcome.step2.ngn')}
      />
      {showList ? (
        <View
          testID="currency-options"
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: tokens.radius['rounded-md'],
            overflow: 'hidden',
          }}
        >
          {options.map((c) => (
            <Pressable
              key={c.code}
              testID={`currency-${c.code}`}
              accessibilityRole="button"
              accessibilityState={{ selected: c.code === 'NGN' && c.active }}
              disabled={!c.active}
              onPress={() => {
                if (c.active) setQuery('');
              }}
              style={{
                padding: tokens.spacing['spacing-md'],
                backgroundColor: c.code === 'NGN' ? theme.tagFill : theme.card,
                opacity: c.active ? 1 : 0.55,
              }}
            >
              <Text tone={c.code === 'NGN' ? 'text' : 'textSecondary'}>{t(c.labelKey)}</Text>
              {!c.active ? (
                <Text variant="micro" tone="textHelper">
                  {t('welcome.currency.soon')}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <Text testID="currency-selected" variant="caption">
          {t('welcome.step2.ngn')}
        </Text>
      )}
    </View>
  );
}
