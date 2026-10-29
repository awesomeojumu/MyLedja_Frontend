import { View } from 'react-native';

import { Button, Footer, Sheet, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { t } from '@/i18n';

import { moneyBackPromptCopy, type MoneyBackChoice, type MoneyBackSuggestion } from './moneyBack';

const sp = tokens.spacing;

/** PU-58 Money back? — never auto-decides; Always-do-this hidden until Phase 4 rules. */
export function MoneyBackPrompt({
  suggestion,
  onChoice,
  onClose,
}: {
  suggestion: MoneyBackSuggestion;
  onChoice: (choice: MoneyBackChoice) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const copy = moneyBackPromptCopy(suggestion);
  const incoming = suggestion.direction === 'incoming';
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
            label={incoming ? t('debts.moneyBack.itsIncome') : t('debts.moneyBack.itsSpending')}
            onPress={() => onChoice('income')}
          />
          <Button
            testID="money-back-confirm"
            label={incoming ? t('debts.moneyBack.record') : t('debts.moneyBack.recordRepayment')}
            onPress={() => {
              onChoice('money_back');
              toast.show(t('debts.moneyBack.toast'));
            }}
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
