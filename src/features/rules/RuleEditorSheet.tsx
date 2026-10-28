import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Footer, Select, Sheet, Text, TextInput, formatDay } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type { TransactionRule, RuleCondition, RuleAction, RuleConditionField, RuleConditionOp, RuleActionKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { previewMatches } from '@/features/rules/ruleEngine';
import { t } from '@/i18n';

const sp = tokens.spacing;

const CONDITION_FIELDS: RuleConditionField[] = ['payee', 'description', 'amount', 'account', 'category', 'notes', 'date'];
const CONDITION_OPS: RuleConditionOp[] = ['contains', 'equals', 'lessThan', 'greaterThan', 'before', 'after'];
const ACTION_KINDS: RuleActionKind[] = ['setCategory', 'renamePayee', 'addNote'];

export function RuleEditorSheet({
  rule,
  snapshot,
  onClose,
  onSave,
  onSaveAndRun,
}: {
  rule: TransactionRule;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (rule: TransactionRule) => Promise<void>;
  onSaveAndRun: (rule: TransactionRule) => Promise<void>;
}) {
  const phone = useSizeClass() === 'phone';
  const [draft, setDraft] = useState(rule);
  const [matchesOpen, setMatchesOpen] = useState(!phone);

  const matches = useMemo(() => previewMatches(snapshot, draft), [snapshot, draft]);
  const categories = snapshot.categories.filter((c) => !c.hidden);
  const accounts = snapshot.accounts.filter((a) => !a.archived);

  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  };

  const updateAction = (index: number, patch: Partial<RuleAction>) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  };

  const editor = (
    <View style={{ gap: sp['spacing-md'], flex: 1 }}>
      <Select
        testID="rule-match-mode"
        label={t('rules.matchMode')}
        options={[
          { value: 'all', label: t('rules.matchAll') },
          { value: 'any', label: t('rules.matchAny') },
        ]}
        value={draft.matchMode}
        onChange={(matchMode) => setDraft({ ...draft, matchMode: matchMode as 'all' | 'any' })}
      />
      <Text variant="heading-sm">{t('rules.when')}</Text>
      {draft.conditions.map((c, i) => (
        <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], alignItems: 'center' }}>
          <Select
            testID={`rule-condition-field-${i}`}
            label={t('rules.fieldLabel')}
            options={CONDITION_FIELDS.map((f) => ({ value: f, label: t(`rules.field.${f}`) }))}
            value={c.field}
            onChange={(field) => updateCondition(i, { field: field as RuleConditionField })}
          />
          <Select
            testID={`rule-condition-op-${i}`}
            label={t('rules.opLabel')}
            options={CONDITION_OPS.map((op) => ({ value: op, label: t(`rules.op.${op}`) }))}
            value={c.op}
            onChange={(op) => updateCondition(i, { op: op as RuleConditionOp })}
          />
          {c.field === 'category' ? (
            <Select
              testID={`rule-condition-value-${i}`}
              label={t('rules.valueLabel')}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              value={c.value}
              onChange={(value) => updateCondition(i, { value })}
            />
          ) : c.field === 'account' ? (
            <Select
              testID={`rule-condition-value-${i}`}
              label={t('rules.valueLabel')}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              value={c.value}
              onChange={(value) => updateCondition(i, { value })}
            />
          ) : (
            <TextInput
              testID={`rule-condition-value-${i}`}
              label={t('rules.valueLabel')}
              value={c.value}
              onChangeText={(value) => updateCondition(i, { value })}
            />
          )}
        </View>
      ))}
      <Button
        kind="secondary"
        label={t('rules.addCondition')}
        onPress={() => setDraft({ ...draft, conditions: [...draft.conditions, { field: 'payee', op: 'contains', value: '' }] })}
      />
      <Text variant="heading-sm">{t('rules.then')}</Text>
      {draft.actions.map((a, i) => (
        <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
          <Select
            testID={`rule-action-kind-${i}`}
            label={t('rules.actionLabel')}
            options={ACTION_KINDS.map((k) => ({ value: k, label: t(`rules.actionKind.${k}`) }))}
            value={a.kind}
            onChange={(kind) => updateAction(i, { kind: kind as RuleActionKind, value: '' })}
          />
          {a.kind === 'setCategory' ? (
            <Select
              testID={`rule-action-value-${i}`}
              label={t('rules.valueLabel')}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              value={a.value}
              onChange={(value) => updateAction(i, { value })}
            />
          ) : (
            <TextInput testID={`rule-action-value-${i}`} label={t('rules.valueLabel')} value={a.value} onChangeText={(value) => updateAction(i, { value })} />
          )}
        </View>
      ))}
      <Button
        kind="secondary"
        label={t('rules.addAction')}
        onPress={() => setDraft({ ...draft, actions: [...draft.actions, { kind: 'setCategory', value: '' }] })}
      />
    </View>
  );

  const matchList = (
    <View style={{ gap: sp['spacing-sm'], flex: 1, minWidth: phone ? undefined : 280 }}>
      <Text variant="heading-sm">{t('rules.matchesTitle', { count: matches.length })}</Text>
      {matches.slice(0, 12).map((m) => (
        <View key={m.eventId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
          <View>
            <Text variant="caption" tone="textSecondary">
              {formatDay(m.date)}
            </Text>
            <Text variant="caption">{m.payeeName || t('payees.noDefaultCategory')}</Text>
          </View>
          <Amount minor={m.amountMinor} variant="caption" />
        </View>
      ))}
      {matches.length > 12 ? (
        <Text variant="caption" tone="textSecondary">
          {t('rules.matchesMore', { count: matches.length - 12 })}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Sheet
      visible
      title={t('rules.editorTitle')}
      onClose={onClose}
      testID="rule-editor"
      width={720}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="rule-save" kind="secondary" label={t('common.save')} onPress={() => void onSave(draft)} />
          <Button
            testID="rule-save-run"
            label={t('rules.saveAndRun', { count: matches.length })}
            onPress={() => void onSaveAndRun(draft)}
            disabled={matches.length === 0}
          />
        </Footer>
      }
    >
      {phone ? (
        <>
          {editor}
          <Button kind="link" label={matchesOpen ? t('rules.hideMatches') : t('rules.showMatches', { count: matches.length })} onPress={() => setMatchesOpen((v) => !v)} />
          {matchesOpen ? matchList : null}
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: sp['spacing-xl'] }}>
          <View style={{ flex: 1 }}>{editor}</View>
          {matchList}
        </View>
      )}
    </Sheet>
  );
}
