import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme, TextInput, Dropdown } from '../../../design';
import { t } from '../../../i18n';
import { CURRENCIES, currencyLabel } from '../currencies';
import { StepHeading, type StepProps } from '../ui';

export function SpaceStep({ draft, update }: StepProps) {
  const { spacing } = useTheme();
  const currencyOptions = useMemo(() => CURRENCIES.map((c) => ({ label: currencyLabel(c.code), value: c.code })), []);
  return (
    <View>
      <StepHeading title={t('wiz.space.title')} body={t('wiz.space.body')} />
      <View style={{ marginBottom: spacing.md }}>
        <TextInput
          label={t('wiz.space.name')}
          placeholder={t('wiz.space.namePlaceholder')}
          value={draft.workspaceName}
          onChangeText={(workspaceName) => update({ workspaceName })}
        />
      </View>
      <View style={{ marginBottom: spacing.md, zIndex: 20 }}>
        <Dropdown label={t('wiz.space.currency')} value={draft.currency} options={currencyOptions} onSelect={(currency) => update({ currency })} />
      </View>
      <View style={{ zIndex: 10 }}>
        <Dropdown
          label={t('wiz.space.week')}
          value={draft.weekStart}
          options={[
            { label: t('welcome.day.monday'), value: 'monday' },
            { label: t('welcome.day.sunday'), value: 'sunday' },
            { label: t('welcome.day.saturday'), value: 'saturday' },
          ]}
          onSelect={(v) => update({ weekStart: v as typeof draft.weekStart })}
        />
      </View>
    </View>
  );
}
