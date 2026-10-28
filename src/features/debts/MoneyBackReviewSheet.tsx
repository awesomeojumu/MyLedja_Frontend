import { useState } from 'react';
import { View } from 'react-native';

import { Button, Footer, InlineError, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { ledgerMessage } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { MoneyBackPrompt } from './MoneyBackPrompt';
import { listMoneyBackReview, type MoneyBackChoice, type MoneyBackSuggestion } from './moneyBack';

const sp = tokens.spacing;

/** Debts banner Review: confirm each imported suggestion (A-13 / P15-07). */
export function MoneyBackReviewSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const [queue, setQueue] = useState<MoneyBackSuggestion[]>(() => (snapshot ? listMoneyBackReview(snapshot) : []));
  const [error, setError] = useState<string | null>(null);
  const current = queue[0] ?? null;

  const onChoice = async (choice: MoneyBackChoice) => {
    if (!current) return;
    setError(null);
    const result = await repo.confirmMoneyBack(
      {
        debtId: current.debtId,
        amount: current.amount,
        date: current.date,
        accountId: current.accountId,
        eventId: current.eventId,
        payeeId: current.payeeId,
      },
      choice,
    );
    if (!result.ok) {
      setError(ledgerMessage(result.error));
      return;
    }
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) onClose();
  };

  if (!current) {
    return (
      <Sheet visible testID="money-back-review" title={t('debts.moneyBack.review')} onClose={onClose} footer={<Footer><Button label={t('common.close')} onPress={onClose} /></Footer>}>
        <Text>{t('debts.emptyBody')}</Text>
      </Sheet>
    );
  }

  return (
    <View>
      <MoneyBackPrompt suggestion={current} onChoice={(c) => void onChoice(c)} onClose={onClose} />
      {error ? (
        <View style={{ position: 'absolute', bottom: sp['spacing-lg'], left: sp['spacing-lg'], right: sp['spacing-lg'] }}>
          <InlineError message={error} />
        </View>
      ) : null}
    </View>
  );
}
