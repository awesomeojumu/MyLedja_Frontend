import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Checkbox, Footer, Sheet, Text, TextInput } from '@/design/components';
import type { TransactionRule } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { previewMatches } from '@/features/rules/ruleEngine';
import { t } from '@/i18n';

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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const previewCount = useMemo(() => {
    let total = 0;
    for (const id of selected) {
      const rule = rules.find((r) => r.id === id);
      if (!rule) continue;
      total += previewMatches(snapshot, rule, from || undefined, to || undefined).length;
    }
    return total;
  }, [selected, rules, snapshot, from, to]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Sheet
      visible
      title={t('rules.runTitle')}
      onClose={onClose}
      testID="run-rules-sheet"
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
      <Text tone="textSecondary">{t('rules.runBody')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TextInput testID="run-rules-from" label={t('rules.fromDate')} value={from} onChangeText={setFrom} />
        <TextInput testID="run-rules-to" label={t('rules.toDate')} value={to} onChangeText={setTo} />
      </View>
      {enabled.map((rule) => (
        <Checkbox key={rule.id} testID={`run-rule-${rule.id}`} label={rule.conditions[0]?.value || t('rules.untitled')} checked={selected.has(rule.id)} onChange={() => toggle(rule.id)} />
      ))}
      <Text tone="textSecondary">{t('rules.runPreview', { count: previewCount })}</Text>
      <Text variant="caption" tone="textSecondary">
        {t('rules.runUndoHint')}
      </Text>
    </Sheet>
  );
}
