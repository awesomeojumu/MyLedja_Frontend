import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Footer, Select, Sheet, Text, TextInput, formatDay } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type {
  TransactionRule,
  RuleCondition,
  RuleAction,
  RuleConditionField,
  RuleConditionOp,
  RuleActionKind,
  RuleStage,
} from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import {
  encodeSplitValue,
  parseSplitValue,
  previewMatches,
  previewRuleChange,
  splitTotalsOk,
} from '@/features/rules/ruleEngine';
import { showRuleStages } from '@/features/rules/helpers';
import { t } from '@/i18n';

const sp = tokens.spacing;

const CONDITION_FIELDS: RuleConditionField[] = ['payee', 'description', 'amount', 'account', 'category', 'notes', 'date', 'money'];
const OPS_BY_FIELD: Record<RuleConditionField, RuleConditionOp[]> = {
  payee: ['equals', 'notEquals', 'isOneOf', 'contains'],
  description: ['contains', 'startsWith', 'equals'],
  amount: ['equals', 'greaterThan', 'lessThan', 'between'],
  money: ['isIn', 'isOut'],
  account: ['equals', 'isOneOf'],
  category: ['equals', 'isEmpty'],
  date: ['dayOfMonth', 'between', 'before', 'after'],
  notes: ['contains'],
};
const ACTION_KINDS: RuleActionKind[] = ['setCategory', 'renamePayee', 'addNote', 'addTag', 'split', 'linkSchedule', 'moneyBack'];

function opsFor(field: RuleConditionField): RuleConditionOp[] {
  return OPS_BY_FIELD[field] ?? ['contains', 'equals'];
}

function draftValid(draft: TransactionRule): { ok: boolean; message?: string } {
  if (draft.conditions.length === 0) return { ok: false, message: t('rules.needCondition') };
  if (draft.actions.length === 0) return { ok: false, message: t('rules.needAction') };
  for (const a of draft.actions) {
    if (a.kind === 'split') {
      const split = parseSplitValue(a.value);
      if (!split) return { ok: false, message: t('rules.splitInvalid') };
      // Amount-mode total checked against matches when saving; percent must be 100 here.
      if (split.mode === 'pct' && !splitTotalsOk(split, 10000n)) return { ok: false, message: t('rules.splitMustTotal') };
    } else if (
      !a.value.trim() &&
      (a.kind === 'setCategory' || a.kind === 'renamePayee' || a.kind === 'linkSchedule' || a.kind === 'moneyBack' || a.kind === 'addTag')
    ) {
      return { ok: false, message: t('rules.needActionValue') };
    }
  }
  const emptyCond = draft.conditions.some((c) => c.op !== 'isEmpty' && c.op !== 'isIn' && c.op !== 'isOut' && !c.value.trim());
  if (emptyCond) return { ok: false, message: t('rules.needCondition') };
  return { ok: true };
}

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
  const size = useSizeClass();
  const phone = size === 'phone';
  const stackMatches = phone || size === 'tablet';
  const [draft, setDraft] = useState(rule);
  const [matchesOpen, setMatchesOpen] = useState(!phone);
  const [validation, setValidation] = useState<string | null>(null);

  const matches = useMemo(() => previewMatches(snapshot, draft), [snapshot, draft]);
  const changing = useMemo(() => previewMatches(snapshot, draft, undefined, undefined, { onlyChanging: true }), [snapshot, draft]);
  const categories = snapshot.categories.filter((c) => !c.hidden);
  const accounts = snapshot.accounts.filter((a) => !a.archived);
  const schedules = snapshot.recurring.filter((r) => !r.cancelled);
  const debts = snapshot.debts.filter((d) => d.status === 'open');
  const showStage = showRuleStages(snapshot.rules.length);

  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c, i) => {
        if (i !== index) return c;
        const next = { ...c, ...patch };
        if (patch.field && patch.field !== c.field) {
          const ops = opsFor(patch.field);
          next.op = ops.includes(c.op) ? c.op : ops[0]!;
          next.value = '';
        }
        return next;
      }),
    }));
  };

  const updateAction = (index: number, patch: Partial<RuleAction>) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  };

  const trySave = async (andRun: boolean) => {
    const v = draftValid(draft);
    if (!v.ok) {
      setValidation(v.message ?? t('rules.needCondition'));
      return;
    }
    setValidation(null);
    if (andRun) await onSaveAndRun(draft);
    else await onSave(draft);
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
      {showStage ? (
        <Select
          testID="rule-stage"
          label={t('rules.stageLabel')}
          options={[
            { value: 'first', label: t('rules.stage.first') },
            { value: 'normal', label: t('rules.stage.normal') },
            { value: 'last', label: t('rules.stage.last') },
          ]}
          value={draft.stage}
          onChange={(stage) => setDraft({ ...draft, stage: stage as RuleStage })}
        />
      ) : null}
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
            options={opsFor(c.field).map((op) => ({ value: op, label: t(`rules.op.${op}`) }))}
            value={c.op}
            onChange={(op) => updateCondition(i, { op: op as RuleConditionOp })}
          />
          {c.op === 'isEmpty' || c.op === 'isIn' || c.op === 'isOut' ? null : c.field === 'category' ? (
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
        <ActionRow
          key={i}
          index={i}
          action={a}
          categories={categories}
          schedules={schedules}
          debts={debts}
          onChange={(patch) => updateAction(i, patch)}
        />
      ))}
      <Button
        kind="secondary"
        label={t('rules.addAction')}
        onPress={() => setDraft({ ...draft, actions: [...draft.actions, { kind: 'setCategory', value: '' }] })}
      />
      {validation ? (
        <Text testID="rule-validation" tone="textSecondary">
          {validation}
        </Text>
      ) : null}
    </View>
  );

  const matchList = (
    <View style={{ gap: sp['spacing-sm'], flex: 1, minWidth: phone ? undefined : 280 }}>
      <Text variant="heading-sm">{t('rules.matchesTitle', { count: matches.length })}</Text>
      {matches.slice(0, 20).map((m) => {
        const after = previewRuleChange(m, draft.actions);
        const beforeCat = snapshot.categories.find((c) => c.id === m.categoryId)?.name ?? m.payeeName;
        const afterLabel =
          after.categoryId != null
            ? snapshot.categories.find((c) => c.id === after.categoryId)?.name ?? after.categoryId
            : after.payeeName ?? after.notes ?? after.tags?.join(', ') ?? '—';
        return (
          <View key={m.eventId} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="textSecondary">
                  {formatDay(m.date)}
                </Text>
                <Text variant="caption">{m.payeeName || t('payees.noDefaultCategory')}</Text>
              </View>
              <Amount minor={m.amountMinor} variant="caption" />
            </View>
            <Text variant="caption" tone="textSecondary" testID={`rule-match-before-after-${m.eventId}`}>
              {t('rules.beforeAfter', { before: beforeCat, after: afterLabel })}
            </Text>
          </View>
        );
      })}
      {matches.length > 20 ? (
        <Text variant="caption" tone="textSecondary">
          {t('rules.matchesMore', { count: matches.length - 20 })}
        </Text>
      ) : null}
    </View>
  );

  const canSave = draftValid(draft).ok;

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
          <Button testID="rule-save" kind="secondary" label={t('rules.saveRule')} disabled={!canSave} onPress={() => void trySave(false)} />
          <Button
            testID="rule-save-run"
            label={t('rules.saveAndRun', { count: changing.length })}
            onPress={() => void trySave(true)}
            disabled={!canSave || changing.length === 0}
          />
        </Footer>
      }
    >
      {stackMatches ? (
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

function ActionRow({
  index,
  action,
  categories,
  schedules,
  debts,
  onChange,
}: {
  index: number;
  action: RuleAction;
  categories: Snapshot['categories'];
  schedules: Snapshot['recurring'];
  debts: Snapshot['debts'];
  onChange: (patch: Partial<RuleAction>) => void;
}) {
  const split = action.kind === 'split' ? parseSplitValue(action.value) ?? { mode: 'pct' as const, parts: [{ categoryId: categories[0]?.id ?? '', value: 50 }, { categoryId: categories[1]?.id ?? categories[0]?.id ?? '', value: 50 }] } : null;

  if (action.kind === 'split' && split) {
    const setParts = (parts: { categoryId: string; value: number }[], mode: 'pct' | 'amt' = split.mode) => {
      onChange({ value: encodeSplitValue(mode, parts) });
    };
    return (
      <View testID={`rule-action-split-${index}`} style={{ gap: sp['spacing-xs'] }}>
        <Select
          testID={`rule-action-kind-${index}`}
          label={t('rules.actionLabel')}
          options={ACTION_KINDS.map((k) => ({ value: k, label: t(`rules.actionKind.${k}`) }))}
          value={action.kind}
          onChange={(kind) => onChange({ kind: kind as RuleActionKind, value: kind === 'split' ? encodeSplitValue('pct', split.parts) : '' })}
        />
        <Select
          testID={`rule-split-mode-${index}`}
          label={t('rules.splitMode')}
          options={[
            { value: 'pct', label: t('rules.splitPct') },
            { value: 'amt', label: t('rules.splitAmt') },
          ]}
          value={split.mode}
          onChange={(mode) => setParts(split.parts, mode as 'pct' | 'amt')}
        />
        {split.parts.map((p, pi) => (
          <View key={pi} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
            <Select
              testID={`rule-split-cat-${index}-${pi}`}
              label={t('rules.valueLabel')}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              value={p.categoryId}
              onChange={(categoryId) => {
                const parts = split.parts.map((x, i) => (i === pi ? { ...x, categoryId } : x));
                setParts(parts);
              }}
            />
            <TextInput
              testID={`rule-split-val-${index}-${pi}`}
              label={split.mode === 'pct' ? t('rules.splitPct') : t('rules.splitAmt')}
              value={String(p.value)}
              onChangeText={(text) => {
                const value = Number(text.replace(/[^\d.]/g, '')) || 0;
                const parts = split.parts.map((x, i) => (i === pi ? { ...x, value } : x));
                setParts(parts);
              }}
            />
          </View>
        ))}
        <Button
          kind="link"
          label={t('rules.splitAddRow')}
          onPress={() => setParts([...split.parts, { categoryId: categories[0]?.id ?? '', value: 0 }])}
        />
        {!splitTotalsOk(split, 10000n) && split.mode === 'pct' ? (
          <Text tone="textSecondary" variant="caption">
            {t('rules.splitMustTotal')}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
      <Select
        testID={`rule-action-kind-${index}`}
        label={t('rules.actionLabel')}
        options={ACTION_KINDS.map((k) => ({ value: k, label: t(`rules.actionKind.${k}`) }))}
        value={action.kind}
        onChange={(kind) => {
          const k = kind as RuleActionKind;
          if (k === 'split') {
            onChange({
              kind: k,
              value: encodeSplitValue('pct', [
                { categoryId: categories[0]?.id ?? '', value: 50 },
                { categoryId: categories[1]?.id ?? categories[0]?.id ?? '', value: 50 },
              ]),
            });
          } else onChange({ kind: k, value: '' });
        }}
      />
      {action.kind === 'setCategory' ? (
        <Select
          testID={`rule-action-value-${index}`}
          label={t('rules.valueLabel')}
          options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
          value={action.value}
          onChange={(value) => onChange({ value })}
        />
      ) : action.kind === 'linkSchedule' ? (
        <Select
          testID={`rule-action-value-${index}`}
          label={t('rules.valueLabel')}
          options={schedules.map((s) => ({ value: s.id, label: s.name }))}
          value={action.value}
          onChange={(value) => onChange({ value })}
        />
      ) : action.kind === 'moneyBack' ? (
        <Select
          testID={`rule-action-value-${index}`}
          label={t('rules.valueLabel')}
          options={debts.map((d) => ({ value: d.id, label: d.name }))}
          value={action.value}
          onChange={(value) => onChange({ value })}
        />
      ) : (
        <TextInput testID={`rule-action-value-${index}`} label={t('rules.valueLabel')} value={action.value} onChangeText={(value) => onChange({ value })} />
      )}
    </View>
  );
}
