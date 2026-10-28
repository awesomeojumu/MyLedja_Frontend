import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Amount,
  Button,
  Card,
  Select,
  Text,
  TextInput,
  formatDay,
  Panel,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Payee } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { rulesForPayee } from '@/features/rules/ruleEngine';
import { ruleSentence, payeeMonogram } from '@/features/rules/helpers';
import { t } from '@/i18n';

import { payeeTransactions } from './helpers';

const sp = tokens.spacing;

export function PayeePanel({
  payee,
  snapshot,
  side,
  onClose,
  onSave,
  onCreateRule,
}: {
  payee: Payee;
  snapshot: Snapshot;
  side: boolean;
  onClose: () => void;
  onSave: (p: Payee) => Promise<void>;
  onCreateRule: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [name, setName] = useState(payee.name);
  const [categoryId, setCategoryId] = useState(payee.defaultCategoryId ?? '');
  const [aliasText, setAliasText] = useState((payee.aliases ?? []).join(', '));
  const [logoUri, setLogoUri] = useState(payee.logoUri ?? '');

  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden);
  const options = [{ value: '', label: t('payees.noDefaultCategory') }, ...categories.map((c) => ({ value: c.id, label: c.name }))];
  const txns = useMemo(() => payeeTransactions(snapshot, payee.id), [snapshot, payee.id]);
  const linkedRules = useMemo(() => rulesForPayee(snapshot.rules, payee), [snapshot, payee]);

  const body = (
    <>
      <Pressable
        testID="payee-logo"
        accessibilityRole="button"
        accessibilityLabel={t('payees.changeLogo')}
        onPress={() => setLogoUri(logoUri ? '' : `mono://${payeeMonogram(name)}`)}
        style={{
          width: 64,
          height: 64,
          borderRadius: tokens.radius['rounded-lg'],
          backgroundColor: theme.tagFill,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
        }}
      >
        <Text variant="heading-md" style={{ color: theme.tagText }}>
          {payeeMonogram(name)}
        </Text>
      </Pressable>
      <TextInput testID="payee-name" label={t('payees.name')} value={name} onChangeText={setName} />
      <Select testID="payee-category" label={t('payees.defaultCategoryLabel')} options={options} value={categoryId} onChange={setCategoryId} />
      <Text variant="caption" tone="textSecondary">
        {t('payees.aliases')}
      </Text>
      <TextInput testID="payee-aliases" label={t('payees.aliases')} value={aliasText} onChangeText={setAliasText} />
      <Text variant="caption" tone="textSecondary">
        {t('payees.aliasesHint')}
      </Text>
      {txns.length ? (
        <View style={{ gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{t('payees.recentTx')}</Text>
          {txns.map((row) => (
            <Pressable key={row.id} accessibilityRole="button" onPress={() => router.push(`/transactions?tx=${row.id}`)}>
              <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text variant="caption" tone="textSecondary">
                    {formatDay(row.date)}
                  </Text>
                  <Text>{row.category || t('payees.noDefaultCategory')}</Text>
                </View>
                <Amount minor={row.amount < 0n ? -row.amount : row.amount} />
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}
      {linkedRules.length ? (
        <View style={{ gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{t('payees.rulesUsing')}</Text>
          {linkedRules.map((rule) => {
            const { when, then } = ruleSentence(rule, snapshot);
            return (
              <Card key={rule.id} style={{ gap: sp['spacing-xs'] }}>
                <Text variant="caption" tone="textSecondary">
                  {when}
                </Text>
                <Text variant="caption">{then}</Text>
              </Card>
            );
          })}
        </View>
      ) : null}
      <Button testID="payee-create-rule" kind="secondary" label={t('payees.createRule')} onPress={onCreateRule} />
      <Button
        testID="payee-save"
        label={t('common.save')}
        onPress={() =>
          void onSave({
            ...payee,
            name: name.trim() || payee.name,
            defaultCategoryId: categoryId || undefined,
            aliases: aliasText.split(',').map((s) => s.trim()).filter(Boolean),
            logoUri: logoUri || undefined,
          })
        }
      />
    </>
  );

  if (side) {
    return (
      <View testID="payee-panel" style={{ flex: 1, maxWidth: 420, borderLeftWidth: 1, borderColor: theme.border, padding: sp['spacing-lg'], gap: sp['spacing-md'] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading-md">{payee.name}</Text>
          <Button kind="link" label={t('common.close')} onPress={onClose} />
        </View>
        {body}
      </View>
    );
  }

  return (
    <Panel visible title={payee.name} onClose={onClose} testID="payee-sheet">
      {body}
    </Panel>
  );
}
