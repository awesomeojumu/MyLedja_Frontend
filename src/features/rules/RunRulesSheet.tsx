import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Checkbox, Footer, PillTag, Sheet, Text, TextInput, formatDay } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { TransactionRule } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { countReconciledSkipped, previewMatches, previewRuleChange } from '@/features/rules/ruleEngine';
import { applyDatePreset, type DatePreset } from '@/features/transactions/filters';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

const sp = tokens.spacing;

const PRESETS: DatePreset[] = ['thisMonth', 'lastMonth', 'last30', 'last3Months', 'thisYear', 'lastYear'];

function presetLabel(p: DatePreset): string {
  switch (p) {
    case 'thisMonth':
      return t('tx.filter.presetThisMonth');
    case 'lastMonth':
      return t('tx.filter.presetLastMonth');
    case 'last30':
      return t('tx.filter.presetLast30');
    case 'last3Months':
      return t('tx.filter.presetLast3Months');
    case 'thisYear':
      return t('tx.filter.presetThisYear');
    case 'lastYear':
      return t('tx.filter.presetLastYear');
  }
}

export function RunRulesSheet({
  snapshot,
  rules,
  onClose,
  onRun,
}: {
  snapshot: Snapshot;
  rules: TransactionRule[];
  onClose: () => void;
  onRun: (ruleIds: string[], range: { from?: string; to?: string }) => Promise<void>;
}) {
  const enabled = rules.filter((r) => r.enabled);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(enabled.map((r) => r.id)));
  const defaultRange = applyDatePreset('last3Months', today());
  const [from, setFrom] = useState(defaultRange.dateFrom ?? '');
  const [to, setTo] = useState(defaultRange.dateTo ?? '');
  const [preset, setPreset] = useState<DatePreset | 'custom'>('last3Months');

  const { previewCount, skipped, samples } = useMemo(() => {
    let total = 0;
    let skip = 0;
    const rows: { id: string; date: string; payee: string; amount: bigint; before: string; after: string }[] = [];
    for (const id of selected) {
      const rule = rules.find((r) => r.id === id);
      if (!rule) continue;
      skip += countReconciledSkipped(snapshot, rule, from || undefined, to || undefined);
      const matches = previewMatches(snapshot, rule, from || undefined, to || undefined, { onlyChanging: true });
      total += matches.length;
      for (const m of matches) {
        if (rows.length >= 20) break;
        const change = previewRuleChange(m, rule.actions);
        const before = snapshot.categories.find((c) => c.id === m.categoryId)?.name ?? m.payeeName;
        const after =
          change.categoryId != null
            ? snapshot.categories.find((c) => c.id === change.categoryId)?.name ?? change.categoryId
            : change.payeeName ?? change.notes ?? change.tags?.join(', ') ?? '—';
        rows.push({ id: m.eventId, date: m.date, payee: m.payeeName, amount: m.amountMinor, before, after });
      }
    }
    return { previewCount: total, skipped: skip, samples: rows };
  }, [selected, rules, snapshot, from, to]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyPreset = (p: DatePreset) => {
    const range = applyDatePreset(p, today());
    setPreset(p);
    setFrom(range.dateFrom ?? '');
    setTo(range.dateTo ?? '');
  };

  return (
    <Sheet
      visible
      title={t('rules.runTitle')}
      onClose={onClose}
      testID="run-rules-sheet"
      width={480}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="run-rules-confirm"
            label={t('rules.runConfirm', { count: previewCount })}
            disabled={selected.size === 0 || previewCount === 0}
            onPress={() => void onRun([...selected], { from: from || undefined, to: to || undefined })}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <Text tone="textSecondary">{t('rules.runBody')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
          {PRESETS.map((p) => (
            <PillTag key={p} testID={`run-rules-preset-${p}`} label={presetLabel(p)} selected={preset === p} onPress={() => applyPreset(p)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TextInput
            testID="run-rules-from"
            label={t('rules.fromDate')}
            value={from}
            onChangeText={(v) => {
              setPreset('custom');
              setFrom(v);
            }}
          />
          <TextInput
            testID="run-rules-to"
            label={t('rules.toDate')}
            value={to}
            onChangeText={(v) => {
              setPreset('custom');
              setTo(v);
            }}
          />
        </View>
        {enabled.map((rule) => (
          <Checkbox
            key={rule.id}
            testID={`run-rule-${rule.id}`}
            label={rule.conditions[0]?.value || t('rules.untitled')}
            checked={selected.has(rule.id)}
            onChange={() => toggle(rule.id)}
          />
        ))}
        <Text testID="run-rules-preview" tone="textSecondary">
          {t('rules.runPreview', { count: previewCount })}
        </Text>
        {skipped > 0 ? (
          <Text testID="run-rules-skipped" variant="caption" tone="textSecondary">
            {t('rules.runSkipped', { count: skipped })}
          </Text>
        ) : null}
        <View style={{ gap: sp['spacing-xs'] }}>
          {samples.map((row) => (
            <View key={row.id} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption">
                  {formatDay(row.date)} · {row.payee}
                </Text>
                <Amount minor={row.amount} variant="caption" />
              </View>
              <Text variant="caption" tone="textSecondary">
                {t('rules.beforeAfter', { before: row.before, after: row.after })}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Sheet>
  );
}
