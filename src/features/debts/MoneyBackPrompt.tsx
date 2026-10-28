import { View } from 'react-native';

import { Button, Footer, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { t } from '@/i18n';

import { moneyBackPromptCopy, type MoneyBackChoice, type MoneyBackSuggestion } from './moneyBack';

const sp = tokens.spacing;

/** A-13 / TECH-SPEC 6.15: never post money back without an explicit choice. */
export function MoneyBackPrompt({
  suggestion,
  onChoice,
  onClose,
}: {
  suggestion: MoneyBackSuggestion;
  onChoice: (choice: MoneyBackChoice) => void;
  onClose: () => void;
}) {
  const copy = moneyBackPromptCopy(suggestion);
  return (
    <Sheet
      visible
      testID="money-back-prompt"
      title={t(copy.titleKey, copy.titleVars)}
      onClose={onClose}
      footer={
        <Footer>
          <Button
            testID="money-back-income"
            kind="secondary"
            label={t('debts.moneyBack.itsIncome')}
            onPress={() => onChoice('income')}
          />
          <Button
            testID="money-back-confirm"
            label={t('debts.moneyBack.record')}
            onPress={() => onChoice('money_back')}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <Text testID="money-back-body">{t(copy.bodyKey, copy.bodyVars)}</Text>
        <Text tone="textSecondary" variant="caption">
          {t('debts.moneyBack.hint')}
        </Text>
      </View>
    </Sheet>
  );
}
