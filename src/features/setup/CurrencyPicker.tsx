import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { RedesignField, RedesignIcon, RedesignSheet, RedesignText } from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';

import { currencyLabel, filterCurrencies } from './currencies';

const sp = tokens.space;

export function CurrencySheet({
  visible,
  selected,
  onClose,
  onPick,
  testID = 'currency-picker',
}: {
  visible: boolean;
  selected: string;
  onClose: () => void;
  onPick: (code: string) => void;
  testID?: string;
}) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => filterCurrencies(query), [query]);
  return (
    <RedesignSheet
      visible={visible}
      title={t('welcome.step2.currency')}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      testID={testID}
    >
      <RedesignField
        testID="currency-search"
        label={t('welcome.step2.currencySearch')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        placeholder={t('welcome.step2.currencySearch')}
      />
      <View>
        {options.map((c) => (
          <Pressable
            key={c.code}
            testID={`currency-${c.code}`}
            accessibilityRole="button"
            onPress={() => {
              onPick(c.code);
              setQuery('');
            }}
            style={{
              minHeight: tokens.density.touch.minTarget,
              paddingVertical: sp.sm,
              borderBottomWidth: 1,
              borderColor: theme.border,
            }}
          >
            <RedesignText tone={c.code === selected ? 'primary' : 'text'}>{currencyLabel(c.code)}</RedesignText>
          </Pressable>
        ))}
      </View>
    </RedesignSheet>
  );
}

export function CurrencyField({
  value,
  onChange,
  testID = 'currency-field',
}: {
  value: string;
  onChange: (code: string) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RedesignField
        testID={testID}
        label={t('welcome.step2.currency')}
        value={currencyLabel(value)}
        editable={false}
        onPress={() => setOpen(true)}
        trailing={<RedesignIcon name="chevron-down" size={20} color={theme.textSecondary} />}
      />
      <CurrencySheet
        visible={open}
        selected={value}
        onClose={() => setOpen(false)}
        onPick={(code) => {
          onChange(code);
          setOpen(false);
        }}
      />
    </>
  );
}
